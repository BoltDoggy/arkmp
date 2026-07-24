import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createApp, run } from '../src/index.js';

const TMP = join(process.cwd(), '.tmp-cli-test');

function cleanup(): void {
  rmSync(TMP, { recursive: true, force: true });
}

beforeEach(() => {
  cleanup();
  mkdirSync(TMP, { recursive: true });
});
afterEach(cleanup);

/** 用 cac 的 parse({run:false}) + await runMatchedCommand() 模拟一次命令执行 */
async function exec(app: ReturnType<typeof createApp>, argv: string[]): Promise<void> {
  app.parse(['node', 'ark-mp', ...argv], { run: false });
  if (app.matchedCommand) {
    await app.runMatchedCommand();
  }
}

describe('createApp', () => {
  it('注册全部命令', () => {
    const exitRef = { code: 0 };
    const app = createApp(exitRef);
    const names = app.commands.map((c) => c.name);
    for (const cmd of ['init', 'build', 'dev', 'compile', 'check', 'preview', 'upload', 'doctor']) {
      expect(names).toContain(cmd);
    }
  });
});

describe('run', () => {
  it('--version 输出版本号', async () => {
    const original = console.log;
    let output = '';
    console.log = (...args: unknown[]) => {
      output += args.join(' ');
      return;
    };
    const code = await run(['--version']);
    console.log = original;
    expect(code).toBe(0);
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('未知命令不崩溃', async () => {
    const code = await run(['nonexistent-command']);
    expect(code).toBe(0);
  });
});

describe('init', () => {
  it('创建默认模板工程', async () => {
    const exitRef = { code: -1 };
    const app = createApp(exitRef);
    process.chdir(TMP);
    await exec(app, ['init', 'my-app']);
    expect(exitRef.code).toBe(0);
    expect(existsSync(join(TMP, 'my-app'))).toBe(true);
    expect(existsSync(join(TMP, 'my-app', 'arkmp.config.ts'))).toBe(true);
  });

  it('拒绝已存在的目录', async () => {
    const exitRef = { code: -1 };
    const app = createApp(exitRef);
    process.chdir(TMP);
    mkdirSync(join(TMP, 'dup'));
    const original = process.stderr.write;
    process.stderr.write = () => true;
    await exec(app, ['init', 'dup']);
    process.stderr.write = original;
    expect(exitRef.code).toBe(1);
  });
});

describe('compile', () => {
  it('编译单个 .ets 文件产出四件套', async () => {
    const exitRef = { code: -1 };
    const app = createApp(exitRef);
    process.chdir(TMP);
    writeFileSync(
      join(TMP, 'Test.ets'),
      [
        '@Component',
        'struct Test {',
        '  @State count: number = 0;',
        '  build() {',
        '    Column() {',
        '      Text("hello")',
        '    }',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
    await exec(app, ['compile', 'Test.ets', '--out', 'out']);
    expect(exitRef.code).toBe(0);
    expect(existsSync(join(TMP, 'out', 'Test.wxml'))).toBe(true);
    expect(existsSync(join(TMP, 'out', 'Test.js'))).toBe(true);
  });

  it('文件不存在时 exit 1', async () => {
    const exitRef = { code: -1 };
    const app = createApp(exitRef);
    process.chdir(TMP);
    const original = process.stderr.write;
    process.stderr.write = () => true;
    await exec(app, ['compile', 'nope.ets']);
    process.stderr.write = original;
    expect(exitRef.code).toBe(1);
  });
});

describe('check', () => {
  it('检查无错误的工程 exit 0', async () => {
    const exitRef = { code: -1 };
    const app = createApp(exitRef);
    process.chdir(TMP);
    writeFileSync(
      join(TMP, 'Ok.ets'),
      ['@Component', 'struct Ok {', '  build() { Column() { Text("ok") } }', '}', ''].join('\n'),
    );
    await exec(app, ['check', '.']);
    expect(exitRef.code).toBe(0);
  });
});

describe('doctor', () => {
  it('输出环境检查结果', async () => {
    const exitRef = { code: -1 };
    const app = createApp(exitRef);
    const original = process.stdout.write;
    let output = '';
    process.stdout.write = (chunk) => {
      output += chunk;
      return true;
    };
    await exec(app, ['doctor']);
    process.stdout.write = original;
    expect(exitRef.code).toBe(0);
    expect(output).toContain('Node.js');
    expect(output).toContain('appId');
  });
});
