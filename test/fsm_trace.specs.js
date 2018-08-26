import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { clone, F, merge, T } from "ramda"
import { ACTION_IDENTITY, create_state_machine, INIT_EVENT, INIT_STATE, traceFSM } from "../src"
import { formatResult } from "./helpers"

const $ = Rx.Observable;
const default_settings = {
  subject_factory: () => {
    const subject = new Rx.Subject();
    // NOTE : this is intended for Rxjs v4-5!! but should work for most also
    subject.emit = subject.next || subject.onNext;
    return subject
  },
  merge: function merge(arrayObs) {return $.merge(...arrayObs)},
  of: $.of,
};
const FALSE_GUARD = function always_false(action, state) {return [{ predicate: F, to: state, action }]};
const TRUE_GUARD = function always_true(to, action) { return [{ predicate: T, to, action }]};

const NO_ACTION = null;
const EVENT1 = 'event1';
const EVENT1_DATA = {
  event1_data_key1: 'event1_data_value1'
}
const a_value = "some value";
const another_value = "another value";
const an_output = {
  outputKey1: 'outputValue1'
};
const another_output = {
  anotherOutputKey1: 'anotherOutputValue1'
};
const model_initial = {
  a_key: a_value,
  another_key: another_value
};
const dummy_action_result = {
  model_update: [],
  output: an_output
};
const another_dummy_action_result = {
  model_update: [],
  output: another_output
};
const replaced_model_property = {
  new_model_key: 'new_model_value'
}
const update_model_ops_1 = [
  { op: "add", path: '/new_model_key_1', value: 'new_model_value_1' },
  { op: "replace", path: '/a_key', value: replaced_model_property },
  { op: "remove", path: '/another_key' },
];
const update_model_ops_2 = [
  { op: "add", path: '/new_model_key_2', value: 'new_model_value_2' },
];
const dummy_action_result_with_update = {
  model_update: update_model_ops_1,
  output: an_output
};
const another_dummy_action_result_with_update = {
  model_update: update_model_ops_2,
  output: another_output
};

function dummy_action(model, event_data, settings) {
  return dummy_action_result
}

function another_dummy_action(model, event_data, settings) {
  return another_dummy_action_result
}

function dummy_action_with_update(model, event_data, settings) {
  return merge(dummy_action_result_with_update, {
    output: {
      // NOTE : ! this is the model before update!!
      model: clone(model),
      event_data: clone(event_data),
      settings: JSON.parse(JSON.stringify(settings))
    }
  })
}

function another_dummy_action_with_update(model, event_data, settings) {
  return merge(another_dummy_action_result_with_update, {
      output: {
        // NOTE : ! this is the model before update!!
        model: clone(model),
        event_data: clone(event_data),
        settings: JSON.parse(JSON.stringify(settings))
      }
    }
  )
}

QUnit.module("Testing traceFSM(env, fsm)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const env = {};
  const decoratedFsmDef = traceFSM(env, fsmDef);
  const decoratedFSM = create_state_machine(decoratedFsmDef, settings);
  const result = decoratedFSM.start();
  const formattedResult = formatResult(result);
  assert.deepEqual(formattedResult, {
    "actionFactory": "ACTION_IDENTITY",
    "controlState": "nok",
    "event": {
      "eventData": {
        "a_key": "some value",
        "another_key": "another value"
      },
      "eventLabel": "init"
    },
    "extendedState": {
      "a_key": "some value",
      "another_key": "another value"
    },
    "guardIndex": 0,
    "model_update": [],
    "newExtendedState": {
      "a_key": "some value",
      "another_key": "another value"
    },
    "output": null,
    "predicate": undefined,
    "settings": {
      "merge": "merge",
      "of": "anonymous",
      "subject_factory": "subject_factory"
    },
    "targetControlState": "A",
    "transitionIndex": 0
  }, `trace is correct`);
});

QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const env = {};
  const decoratedFsmDef = traceFSM(env, fsmDef);
  const decoratedFSM = create_state_machine(decoratedFsmDef, settings);
  const result1 = decoratedFSM.start();
  const result2 = decoratedFSM.yield({ [EVENT1]: EVENT1_DATA });
  const formattedResult1 = formatResult(result1);
  const formattedResult2 = formatResult(result2);
  const cloned_model_initial = clone(model_initial);

  assert.deepEqual([formattedResult1, formattedResult2],
    [
      {
        "actionFactory": "dummy_action_with_update",
        "controlState": "nok",
        "event": {
          "eventData": {
            "a_key": "some value",
            "another_key": "another value"
          },
          "eventLabel": "init"
        },
        "extendedState": {
          "a_key": "some value",
          "another_key": "another value"
        },
        "guardIndex": 0,
        "model_update": [
          {
            "op": "add",
            "path": "/new_model_key_1",
            "value": "new_model_value_1"
          },
          {
            "op": "replace",
            "path": "/a_key",
            "value": {
              "new_model_key": "new_model_value"
            }
          },
          {
            "op": "remove",
            "path": "/another_key"
          }
        ],
        "newExtendedState": {
          "a_key": {
            "new_model_key": "new_model_value"
          },
          "new_model_key_1": "new_model_value_1"
        },
        "output": {
          "event_data": {
            "a_key": "some value",
            "another_key": "another value"
          },
          "model": {
            "a_key": "some value",
            "another_key": "another value"
          },
          "settings": {}
        },
        "predicate": undefined,
        "settings": {
          "merge": "merge",
          "of": "anonymous",
          "subject_factory": "subject_factory"
        },
        "targetControlState": "A",
        "transitionIndex": 0
      },
      {
        "actionFactory": "another_dummy_action_with_update",
        "controlState": "A",
        "event": {
          "eventData": {
            "event1_data_key1": "event1_data_value1"
          },
          "eventLabel": "event1"
        },
        "extendedState": {
          "a_key": {
            "new_model_key": "new_model_value"
          },
          "new_model_key_1": "new_model_value_1"
        },
        "guardIndex": 0,
        "model_update": [
          {
            "op": "add",
            "path": "/new_model_key_2",
            "value": "new_model_value_2"
          }
        ],
        "newExtendedState": {
          "a_key": {
            "new_model_key": "new_model_value"
          },
          "new_model_key_1": "new_model_value_1",
          "new_model_key_2": "new_model_value_2"
        },
        "output": {
          "event_data": {
            "event1_data_key1": "event1_data_value1"
          },
          "model": {
            "a_key": {
              "new_model_key": "new_model_value"
            },
            "new_model_key_1": "new_model_value_1"
          },
          "settings": {}
        },
        "predicate": undefined,
        "settings": {
          "merge": "merge",
          "of": "anonymous",
          "subject_factory": "subject_factory"
        },
        "targetControlState": "B",
        "transitionIndex": 1
      }
    ], `trace is correct`);
});

// TODO : continue with the rest of the tests from no-hierarchy.specs
// TODO : write tests then for the tracing decorator