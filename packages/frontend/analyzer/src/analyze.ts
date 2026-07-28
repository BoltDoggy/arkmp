import type { Diagnostic } from '@arkmp/diagnostics';
import { DiagnosticCollector, errorDiagnostic } from '@arkmp/diagnostics';
import type { ComponentModel, LifecycleHooks, UINode } from '@arkmp/ir';
import { assignNodeIds } from '@arkmp/ir';
import ts from 'typescript';
import { DECORATOR_WHITELIST, decoratorName, getDecorators } from './decorators';
import { classifyExpression, isWxsEligible } from './expressions';
import { bodyText, buildRootTree, type UITreeContext } from './ui-tree';

/** analyzer 阶段诊断码（E1xxx：语法/组件不可编译，见 08 篇诊断码总表）。 */
export const ANALYZER_ERROR_CODES = {
  /** 未知装饰器（不在 08 篇白名单内） */
  UNKNOWN_DECORATOR: 'E1101',
  /** build()/Builder 中无法识别的 UI 语法 */
  UNSUPPORTED_UI_SYNTAX: 'E1102',
  /** build()/Builder 缺少唯一组件根节点 */
  INVALID_BUILD_ROOT: 'E1103',
  /** 文件中没有组件声明（class/struct） */
  MISSING_COMPONENT: 'E1104',
  /** 组件缺少 build() 方法 */
  MISSING_BUILD: 'E1105',
} as const;

/** analyze 的返回值。 */
export interface AnalyzeResult {
  model: ComponentModel;
  diagnostics: Diagnostic[];
}

/**
 * ArkUI 生命周期钩子（05 篇映射到小程序页面/组件生命周期）。
 * 这些钩子名经 analyzer 识别后存入 model.lifecycle，由 transform-js 按固定顺序输出，
 * 再由 runtime 映射到小程序钩子。
 *
 * 小程序原生命名（onLoad/onShow/attached 等）不在此列表中——它们经 analyzer
 * 归入 model.methods（保留原始参数名），由 runtime 透传/映射到对应钩子，
 * 从而同时支持两套命名体系（05 篇映射表，无重名冲突）。
 */
const LIFECYCLE_NAMES = [
  'aboutToAppear',
  'aboutToDisappear',
  'onPageShow',
  'onPageHide',
  'onDidBuild',
  'onPullRefresh',
] as const;

const WHITELIST: ReadonlySet<string> = new Set(DECORATOR_WHITELIST);

/**
 * 语义分析（02 篇②）：将 parser 产出的 TS AST 转换为 ComponentModel（核心 IR）。
 *
 * - 装饰器白名单校验，未知装饰器报 E1101；
 * - 提取 states / props / lifecycle / methods（方法体序列化为源码文本）；
 * - build() 与 @Builder 方法 → UINode 树（控制流归一为 IfNode/ForEachNode）；
 * - 结尾对 buildTree 调 assignNodeIds 分配稳定节点 id。
 */
export function analyze(sourceFile: ts.SourceFile, fileName: string = sourceFile.fileName): AnalyzeResult {
  const collector = new DiagnosticCollector();
  const ctx: UITreeContext = { sourceFile, fileName, diagnostics: collector.diagnostics };

  const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
  if (classDecl === undefined) {
    collector.add(
      errorDiagnostic(ANALYZER_ERROR_CODES.MISSING_COMPONENT, '文件中没有组件声明（struct/class）', { file: fileName }),
    );
    return { model: emptyModel(), diagnostics: collector.diagnostics };
  }

  const model: ComponentModel = {
    name: classDecl.name?.text ?? 'Anonymous',
    isEntry: false,
    states: [],
    props: [],
    lifecycle: {},
    methods: [],
    wxsMethods: [],
    buildTree: { type: 'component', component: 'Column', params: [], children: [], styleCalls: [], eventCalls: [] },
    builders: {},
  };

  // 类级装饰器：@Entry / @Component
  for (const decorator of getDecorators(classDecl)) {
    const name = checkDecorator(decorator, collector, ctx);
    if (name === 'Entry') {
      model.isEntry = true;
      const options = entryOptions(decorator);
      if (options !== undefined) model.entryOptions = options;
    }
  }

  let buildBody: ts.Block | undefined;

  for (const member of classDecl.members) {
    for (const decorator of getDecorators(member)) {
      checkDecorator(decorator, collector, ctx);
    }

    if (ts.isPropertyDeclaration(member)) {
      extractProperty(member, model, ctx);
    } else if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
      const methodName = member.name.text;
      const decoratorNames = new Set(getDecorators(member).map(decoratorName));

      if (decoratorNames.has('Styles') || decoratorNames.has('Extend')) {
        continue; // 样式复用方法由 L2 样式链处理，analyze 不提取
      }
      if (member.body === undefined) continue;

      if (methodName === 'build') {
        buildBody = member.body;
      } else if (decoratorNames.has('Builder')) {
        model.builders[methodName] = buildRootTree(member.body.statements, ctx, `@Builder ${methodName}()`);
      } else if ((LIFECYCLE_NAMES as readonly string[]).includes(methodName)) {
        model.lifecycle[methodName as keyof LifecycleHooks] = bodyText(member.body, ctx);
      } else {
        model.methods.push({
          name: methodName,
          params: member.parameters.map((p) => p.name.getText(sourceFile)),
          body: bodyText(member.body, ctx),
        });
        // WXS 合格的纯函数方法提取到 wxsMethods
        if (isWxsEligible(member)) {
          model.wxsMethods.push({
            name: methodName,
            params: member.parameters.map((p) => p.name.getText(sourceFile)),
            body: bodyText(member.body, ctx),
          });
        }
      }
    }
  }

  if (buildBody === undefined) {
    collector.add(
      errorDiagnostic(ANALYZER_ERROR_CODES.MISSING_BUILD, `组件 ${model.name} 缺少 build() 方法`, {
        file: fileName,
      }),
    );
  } else {
    ctx.methodNames = new Set(model.wxsMethods.map((m) => m.name));
    model.buildTree = buildRootTree(buildBody.statements, ctx, `组件 ${model.name} 的 build()`);
  }

  assignNodeIds(model.buildTree);
  return { model, diagnostics: collector.diagnostics };
}

/** 校验装饰器是否在白名单内，返回装饰器名。 */
function checkDecorator(decorator: ts.Decorator, collector: DiagnosticCollector, ctx: UITreeContext): string {
  const name = decoratorName(decorator);
  if (!WHITELIST.has(name)) {
    const pos = ts.getLineAndCharacterOfPosition(ctx.sourceFile, decorator.getStart(ctx.sourceFile));
    collector.add(
      errorDiagnostic(ANALYZER_ERROR_CODES.UNKNOWN_DECORATOR, `不支持的装饰器：@${name}`, {
        file: ctx.fileName,
        line: pos.line + 1,
        column: pos.character + 1,
        help: '见 docs/arkui-miniprogram/08-limitations.md 装饰器白名单',
      }),
    );
  }
  return name;
}

/** 提取字段：@State → states；@Prop/@Link/无装饰器 → props。 */
function extractProperty(member: ts.PropertyDeclaration, model: ComponentModel, ctx: UITreeContext): void {
  const name = member.name.getText(ctx.sourceFile);
  const type = member.type !== undefined ? member.type.getText(ctx.sourceFile) : 'any';
  const initialValue =
    member.initializer !== undefined ? classifyExpression(member.initializer, ctx.sourceFile) : undefined;
  const decorators = getDecorators(member);
  const names = new Set(decorators.map(decoratorName));

  if (names.has('State')) {
    const watchDecorator = decorators.find((d) => decoratorName(d) === 'Watch');
    model.states.push({ name, type, initialValue, watch: watchName(watchDecorator) });
  } else if (names.has('Prop')) {
    model.props.push({ name, type, kind: 'prop', initialValue });
  } else if (names.has('Link')) {
    model.props.push({ name, type, kind: 'link', initialValue });
  } else {
    model.props.push({ name, type, kind: 'plain', initialValue });
  }
}

/** 取 @Watch('回调名') 的回调方法名。 */
function watchName(decorator: ts.Decorator | undefined): string | undefined {
  if (decorator === undefined) return undefined;
  const expr = decorator.expression;
  if (!ts.isCallExpression(expr)) return undefined;
  const arg = expr.arguments[0];
  return arg !== undefined && ts.isStringLiteral(arg) ? arg.text : undefined;
}

/**
 * 静态求值 `@Entry({...})` 的对象字面量参数（05 篇「页面行为配置」）。
 * 仅支持字面量（字符串/数字/布尔/嵌套对象/数组）；含不可静态求值项时整体返回 undefined。
 */
function entryOptions(decorator: ts.Decorator): Record<string, unknown> | undefined {
  const expr = decorator.expression;
  if (!ts.isCallExpression(expr)) return undefined;
  const arg = expr.arguments[0];
  if (arg === undefined || !ts.isObjectLiteralExpression(arg)) return undefined;
  const value = staticValue(arg);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** 静态求值字面量表达式；不可静态求值时返回 undefined。 */
function staticValue(expr: ts.Expression): unknown {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(expr) && ts.isNumericLiteral(expr.operand)) {
    const n = Number(expr.operand.text);
    if (expr.operator === ts.SyntaxKind.MinusToken) return -n;
    if (expr.operator === ts.SyntaxKind.PlusToken) return n;
    return undefined;
  }
  if (ts.isArrayLiteralExpression(expr)) {
    const items: unknown[] = [];
    for (const el of expr.elements) {
      const v = staticValue(el);
      if (v === undefined) return undefined;
      items.push(v);
    }
    return items;
  }
  if (ts.isObjectLiteralExpression(expr)) {
    const obj: Record<string, unknown> = {};
    for (const prop of expr.properties) {
      if (!ts.isPropertyAssignment(prop)) return undefined;
      const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined;
      if (key === undefined) return undefined;
      const v = staticValue(prop.initializer);
      if (v === undefined) return undefined;
      obj[key] = v;
    }
    return obj;
  }
  return undefined;
}

function emptyModel(): ComponentModel {
  return {
    name: '',
    isEntry: false,
    states: [],
    props: [],
    lifecycle: {},
    methods: [],
    wxsMethods: [],
    buildTree: { type: 'component', component: 'Column', params: [], children: [], styleCalls: [], eventCalls: [] },
    builders: {},
  };
}
