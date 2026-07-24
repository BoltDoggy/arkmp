import { noGeometryTransition } from '../src/rules/no-geometry-transition.js';
import { ruleTester } from './helpers.js';

ruleTester.run('no-geometry-transition', noGeometryTransition, {
  valid: [
    // 普通 transition() 进出场动画是支持的（06 篇动画适配）
    'class A { build() { Column().transition(); } }',
    'class A { build() { Image("a.png"); } }',
  ],
  invalid: [
    // E1003：链式 geometryTransition
    {
      code: 'class A { build() { Image("a.png").geometryTransition("shared"); } }',
      errors: [{ messageId: 'geometryTransition' }],
    },
    {
      code: 'class A { build() { Column().geometryTransition(id); } }',
      errors: [{ messageId: 'geometryTransition' }],
    },
  ],
});
