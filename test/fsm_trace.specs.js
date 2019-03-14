import * as QUnit from "qunitjs"
import { clone, F, merge, T } from "ramda"
import { ACTION_IDENTITY, create_state_machine, INIT_EVENT, INIT_STATE, NO_OUTPUT, traceFSM } from "../src"
import { formatResult } from "./helpers"
import { assertContract, isArrayUpdateOperations } from "../test/helpers"
import { applyPatch } from "json-patch-es6/lib/duplex"
import { CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE } from "../src/properties"

const default_settings = {};
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
const initialExtendedState = {
  a_key: a_value,
  another_key: another_value
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
  updates: update_model_ops_1,
  outputs: an_output
};
const another_dummy_action_result_with_update = {
  updates: update_model_ops_2,
  outputs: another_output
};

/**
 *
 * @param {ExtendedState} extendedState
 * @param {Operation[]} extendedStateUpdateOperations
 * @returns {ExtendedState}
 */
export function applyJSONpatch(extendedState, extendedStateUpdateOperations) {
  assertContract(isArrayUpdateOperations, [extendedStateUpdateOperations],
    `applyUpdateOperations : ${CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE}`);

  // NOTE : we don't validate operations, to avoid throwing errors when for instance the value property for an
  // `add` JSON operation is `undefined` ; and of course we don't mutate the document in place
  return applyPatch(extendedState, extendedStateUpdateOperations, false, false).newDocument;
}

function dummy_action_with_update(extendedState, event_data, settings) {
  return merge(dummy_action_result_with_update, {
    outputs: {
      // NOTE : ! this is the extendedState before update!!
      model: clone(extendedState),
      event_data: clone(event_data),
      settings: JSON.parse(JSON.stringify(settings))
    }
  })
}

function another_dummy_action_with_update(extendedState, event_data, settings) {
  return merge(another_dummy_action_result_with_update, {
      outputs: {
        // NOTE : ! this is the extendedState before update!!
        model: clone(extendedState),
        event_data: clone(event_data),
        settings: JSON.parse(JSON.stringify(settings))
      }
    }
  )
}

QUnit.module("Testing traceFSM(env, fsm)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' , B:''},
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: initialExtendedState,
    updateState : applyJSONpatch,
    settings : default_settings,
  };
  const decoratedFsmDef = traceFSM({}, fsmDef);
  const decoratedFSM = create_state_machine(decoratedFsmDef, {});
  const result = decoratedFSM({'ev': initialExtendedState});
  const formattedResult = result.map(formatResult);
  assert.deepEqual(formattedResult,
    [{
    "actionFactory": "ACTION_IDENTITY",
    "controlState": "A",
    "event": {
      "eventData": {
        "a_key": "some value",
        "another_key": "another value"
      },
      "eventLabel": "ev"
    },
    "extendedState": {
      "a_key": "some value",
      "another_key": "another value"
    },
    "guardIndex": 0,
    "updates": [],
    "newExtendedState": {
      "a_key": "some value",
      "another_key": "another value"
    },
    "outputs": null,
    "predicate": undefined,
    "settings": {},
    "targetControlState": "B",
    "transitionIndex": 1
  }], `trace is correct`);
});

QUnit.test("INIT event, 2 actions with extended state update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initialExtendedState: initialExtendedState,
    updateState : applyJSONpatch,
    settings : default_settings,
  };
  const decoratedFsmDef = traceFSM({}, fsmDef);
  const decoratedFSM = create_state_machine(decoratedFsmDef, {});
  const result2 = decoratedFSM({ [EVENT1]: EVENT1_DATA });
  const formattedResult2 = result2.map(formatResult);

  assert.deepEqual([formattedResult2],
    [
      [{
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
        "updates": [
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
        "outputs": {
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
        "settings": {},
        "targetControlState": "B",
        "transitionIndex": 1
      }]
    ], `trace is correct`);
});

// NOTE : we skip this test as the corresponding state machine violates our contract. We do not allow transitions
// for the same triggering event on two states in the same hierarchy (to avoid ambiguity : behaviour would depend on
// evaluation order). Contract is violated here for input D
QUnit.skip("all transitions topologies up to 4 levels of state nesting", function exec_test(assert) {
  // NOTE : cf. graph in test assets
  // States
  const s = 's';
  const s1 = 's1';
  const s11 = 's11';
  const s2 = 's2';
  const s21 = 's21';
  const s211 = 's211';
  const states = {
    [s]: {
      [s1]: { [s11]: '' },
      [s2]: { [s21]: { [s211]: '' } }
    }
  };

  // Events
  const A = 'eventA';
  const B = 'eventB';
  const C = 'eventC';
  const D = 'eventD';
  const E = 'eventE';
  const F = 'eventF';
  const G = 'eventG';
  const H = 'eventH';
  const I = 'eventI';

  // Guards
  function isFoo0(extS, evD) {
    return extS.foo === 0
  }

  function isFoo1(extS, evD) {
    return extS.foo === 1
  }

  // Actions
  function updateFooTo0(extS, evD) {
    return {
      updates: [{ op: 'add', path: '/foo', value: 0 }],
      outputs: NO_OUTPUT
    }
  }

  function updateFooTo1(extS, evD) {
    return {
      updates: [{ op: 'add', path: '/foo', value: 1 }],
      outputs: NO_OUTPUT
    }
  }

  const fsmDef = {
    states,
    events: [A, B, C, D, E, F, G, H, I],
    initialExtendedState: {},
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: s2, action: updateFooTo0 },
      { from: s2, event: INIT_EVENT, to: s211, action: ACTION_IDENTITY },
      { from: s2, event: I, guards: [{ to: s2, predicate: isFoo0, action: updateFooTo1 }] },
      { from: s21, event: I, guards: [{ to: s21, predicate: isFoo0, action: updateFooTo1 }] },
      { from: s211, event: I, guards: [{ to: s211, predicate: isFoo0, action: updateFooTo1 }] },
      { from: s2, event: C, to: s1, action: ACTION_IDENTITY },
      { from: s2, event: F, to: s11, action: ACTION_IDENTITY },
      { from: s21, event: INIT_EVENT, to: s211, action: ACTION_IDENTITY },
      { from: s21, event: G, to: s1, action: ACTION_IDENTITY },
      { from: s21, event: B, to: s211, action: ACTION_IDENTITY },
      { from: s21, event: A, to: s21, action: ACTION_IDENTITY },
      { from: s211, event: D, to: s21, action: ACTION_IDENTITY },
      { from: s211, event: H, to: s, action: ACTION_IDENTITY },
      { from: s, event: INIT_EVENT, to: s11, action: ACTION_IDENTITY },
      { from: s, event: I, guards: [{ to: s, predicate: isFoo1, action: updateFooTo0 }] },
      { from: s, event: E, to: s11, action: ACTION_IDENTITY },
      { from: s1, event: INIT_EVENT, to: s11, action: ACTION_IDENTITY },
      { from: s1, event: I, to: s1, action: ACTION_IDENTITY },
      { from: s11, event: I, to: s11, action: ACTION_IDENTITY },
      { from: s1, event: D, guards: [{ to: s, predicate: isFoo0, action: updateFooTo1 }] },
      { from: s1, event: B, to: s11, action: ACTION_IDENTITY },
      { from: s1, event: A, to: s1, action: ACTION_IDENTITY },
      { from: s1, event: C, to: s2, action: ACTION_IDENTITY },
      { from: s1, event: F, to: s211, action: ACTION_IDENTITY },
      { from: s11, event: D, guards: [{ to: s1, predicate: isFoo1, action: updateFooTo0 }] },
      { from: s11, event: H, to: s, action: ACTION_IDENTITY },
      { from: s11, event: G, to: s211, action: ACTION_IDENTITY },
    ],
    updateState : applyJSONpatch,
  };
  const settings = default_settings;
  const eventSequence = [INIT_EVENT, G, I, A, D, D, C, E, E, G, I, I];
  const inputSequence = eventSequence.map(x => ({ [x]: null }));
  const decoratedFsmDef = traceFSM(settings, fsmDef);
  const decoratedFSM = create_state_machine(decoratedFsmDef, settings);
  const outputSequence = inputSequence.map(decoratedFSM);
  const formattedResults = outputSequence.map(output => output && output.map(formatResult));
  assert.deepEqual(formattedResults,
    [
      [
        {
          "actionFactory": "updateFooTo0",
          "controlState": "nok",
          "event": {
            "eventData": null,
            "eventLabel": "init"
          },
          "extendedState": {},
          "guardIndex": 0,
          "updates": [
            {
              "op": "add",
              "path": "/foo",
              "value": 0
            }
          ],
          "newExtendedState": {
            "foo": 0
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "subject_factory": "subject_factory",
            "updateState": "applyJSONpatch"
          },
          "targetControlState": "s2",
          "transitionIndex": 0
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "s2",
          "event": {
            "eventData": null,
            "eventLabel": "init"
          },
          "extendedState": {
            "foo": 0
          },
          "guardIndex": 0,
          "updates": [],
          "newExtendedState": {
            "foo": 0
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "updateState": "applyJSONpatch"
          },
          "targetControlState": "s211",
          "transitionIndex": 1
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "s21",
          "event": {
            "eventData": null,
            "eventLabel": "eventG"
          },
          "extendedState": {
            "foo": 0
          },
          "guardIndex": 0,
          "updates": [],
          "newExtendedState": {
            "foo": 0
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "updateState": "applyJSONpatch"
          },
          "targetControlState": "s1",
          "transitionIndex": 8
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "s1",
          "event": {
            "eventData": null,
            "eventLabel": "init"
          },
          "extendedState": {
            "foo": 0
          },
          "guardIndex": 0,
          "updates": [],
          "newExtendedState": {
            "foo": 0
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "updateState": "applyJSONpatch"
          },
          "targetControlState": "s11",
          "transitionIndex": 16
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "s11",
          "event": {
            "eventData": null,
            "eventLabel": "eventI"
          },
          "extendedState": {
            "foo": 0
          },
          "guardIndex": 0,
          "updates": [],
          "newExtendedState": {
            "foo": 0
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "updateState": "applyJSONpatch"
          },
          "targetControlState": "s11",
          "transitionIndex": 18
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "s1",
          "event": {
            "eventData": null,
            "eventLabel": "eventA"
          },
          "extendedState": {
            "foo": 0
          },
          "guardIndex": 0,
          "updates": [],
          "newExtendedState": {
            "foo": 0
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "updateState": "applyJSONpatch"
          },
          "targetControlState": "s1",
          "transitionIndex": 21
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "s1",
          "event": {
            "eventData": null,
            "eventLabel": "init"
          },
          "extendedState": {
            "foo": 0
          },
          "guardIndex": 0,
          "updates": [],
          "newExtendedState": {
            "foo": 0
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "updateState": "applyJSONpatch"
          },
          "targetControlState": "s11",
          "transitionIndex": 16
        }
      ],
    ], `...`);
});
