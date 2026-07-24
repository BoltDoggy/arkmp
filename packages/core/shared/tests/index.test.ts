import { describe, expect, it } from 'vitest';
import { createConsoleLogger, hashContent, normalizePath } from '@arkmp/shared';

describe('hashContent', () => {
  it('相同内容产生相同哈希', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'));
  });

  it('不同内容产生不同哈希', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('输出为 40 位 hex（sha1）', () => {
    expect(hashContent('')).toMatch(/^[0-9a-f]{40}$/);
    // 已知向量：sha1("hello")
    expect(hashContent('hello')).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });
});

describe('normalizePath', () => {
  it('将反斜杠统一为正斜杠', () => {
    expect(normalizePath('pages\\index\\Index.ets')).toBe('pages/index/Index.ets');
  });

  it('去掉开头的 ./', () => {
    expect(normalizePath('./pages/Index.ets')).toBe('pages/Index.ets');
  });

  it('已是 posix 路径时保持不变', () => {
    expect(normalizePath('pages/Index.ets')).toBe('pages/Index.ets');
  });

  it('混合分隔符', () => {
    expect(normalizePath('.\\src\\pages/Index.ets')).toBe('src/pages/Index.ets');
  });
});

describe('createConsoleLogger', () => {
  function createSink() {
    const lines: string[] = [];
    const sink = {
      debug: (msg: string) => lines.push(msg),
      info: (msg: string) => lines.push(msg),
      warn: (msg: string) => lines.push(msg),
      error: (msg: string) => lines.push(msg),
    };
    return { lines, sink };
  }

  it('默认级别为 info，debug 不输出', () => {
    const { lines, sink } = createSink();
    const logger = createConsoleLogger('info', sink);
    logger.debug('hidden');
    logger.info('shown');
    expect(lines).toEqual(['[arkmp] shown']);
  });

  it('debug 级别输出全部日志', () => {
    const { lines, sink } = createSink();
    const logger = createConsoleLogger('debug', sink);
    logger.debug('d');
    logger.warn('w');
    logger.error('e');
    expect(lines).toEqual(['[arkmp] d', '[arkmp] w', '[arkmp] e']);
  });

  it('error 级别只输出 error', () => {
    const { lines, sink } = createSink();
    const logger = createConsoleLogger('error', sink);
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(lines).toEqual(['[arkmp] e']);
  });
});
