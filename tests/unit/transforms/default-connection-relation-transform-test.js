import { module, test } from 'qunit';

import { setupTest } from 'apollo/tests/helpers';

module(
  'Unit | Transform | default connection relation transform',
  function (hooks) {
    setupTest(hooks);

    // Replace this with your real tests.
    test('it exists', function (assert) {
      let transform = this.owner.lookup(
        'transform:default-connection-relation-transform',
      );
      assert.ok(transform);
    });
  },
);
