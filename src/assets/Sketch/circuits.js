/**
 * @typedef {String} Name
 * CONTRACT : Name's string must start with a letter i.e. [a-zA-Z] (and miscellaneous letters from other languages' alphabet)
 */
/**
 * @typedef {String} URI
 * CONTRACT : URI's string must start with a letter i.e. [a-zA-Z] (and miscellaneous letters from other languages' alphabet)
 */
/**
 * @typedef {Number} Identifier
 */
/**
 * @typedef {Name} Port_Name
 */
/**
 * @typedef {*} Settings
 */
/**
 * @typedef {Settings} Chip_Settings
 */
/**
 * @typedef {Object} Chip
 * @property {Name} serie
 * @property {URI} uri
 * - CONTRACT : MUST be unique
 * @property {Ports} ports
 * CONTRACT :
 * - order of Ports.IN/Ports.OUT is meaningful. Ports are connected in order of definition
 * NOTE : an helper function will make it possible to create a chip without having to duplicate `chip_uri` in all ports
 * @property {Transform} transform
 * @property {Chip_Settings} settings
 * @property {Chip_Test} test
 */
/**
 * @typedef {function() : Object<String, Rx.Observable>} Transform
 * - function which takes a variadic number of observables, and whose last argument is the `settings` parameter
 * - returns an object which contains a dictionary whose keys are port names, and whose values are the output observables
 */
/**
 * @typedef {Object} Ports
 * @property {Array<Port_Name>} IN
 * @property {Array<Port_Name>} OUT
 */
/**
 * @typedef {Object} Chip_Test
 * @property {Rx.Subject} simulate
 * @property {Rx.Subject} readout
 */

/**
 * @typedef {URI} Port_URI
 * - made from Port.chip_uri and Port.port_name (helper function provided to do so)
 */
/**
 * @typedef {Object<Port_URI, *>} Port_Labelled_Message
 * Type for messages with only one public key which is the port uri
 * - Contract : only one public enumerable own property
 */

/**
 * @typedef {Rx.Subject} IN_Connector
 */
/**
 * @typedef {Rx.Observable} OUT_Connector
 */
/**
 * @typedef {Object<Port_URI, IN_Connector>} IN_Connector_Dict
 * - dictionary for female connectors (IN subjects will subscribe to the OUT observables)
 * - OUT = transform(IN)
 */
/**
 * @typedef {Object<Port_URI, OUT_Connector>} OUT_Connector_Dict
 * - dictionary for male connectors (IN subjects will subscribe to the OUT observables)
 * - OUT = transform(IN)
 */
/**
 * @typedef {Object} Link
 * @property {IN_Port} IN_port
 * @property {OUT_Port} OUT_port
 */
/**
 * @typedef {Port} IN_Port
 */
/**
 * @typedef {Port} OUT_Port
 */
/**
 * @typedef {Object} Port
 * @property {URI} chip_uri
 * @property {Name} port_name
 */

/**
 * @typedef {Object} Circuit
 * @property {URI} uri
 * - CONTRACT : MUST be unique
 * - NOTE : UNUSED!!
 * @property {Array<Chip>} chips
 * - For instance, [Chip2, Chip1, Chip3]
 * CONTRACT :
 * - chips are connected/wired in array order
 * @property {Ports_Map} ports_map. Those ports are the interface the circuit exposes to outside.
 * CONTRACT : Each exposed port must correspond to a port of a chip in `chips`
 * NOTE : port order here is insignificant for circuits. Ports are linked to chips, and ports are connected in order of the chips port array
 * NOTE : ports are not wired till a containing circuit requests it
 * @property {Array<Link>} links
 * @property {Chip_Test} test. Same as for the chip
 */
/**
 * @typedef {Object} Ports_Map
 * @property {IN_Ports_Map} IN
 * @property {OUT_Ports_Map} OUT
 */
/**
 * @typedef {Object<String, IN_Port>} IN_Ports_Map
 * - Dictionnary where :
 *   + key is exposed port name
 *   + value is the IN port to map the exposed port to
 */
/**
 * @typedef {Object<String, OUT_Port>} OUT_Ports_Map
 * - Dictionnary where :
 *   + key is exposed port name
 *   + value is the OUT port to map the exposed port to
 */

/**
 * @typedef {Chip} Controller
 */
/**
 * @typedef {Object} Controller_Order
 * @property {String} command
 * @property {Plug_In_Parameters} parameters
 * TODO : this is for create, add also for delete
 */
/**
 * @typedef {{circuit: Circuit|Chip, links : Array<Link>}} Plug_In_Parameters
 */

  // TODO : test routines test(input sequence, output sequence, simulate connector, readout connector)

define(function (require) {
  var Rx = require('rx');
  var _ = require('lodash');
  var utils = require('utils');
  var Err = require('custom_errors');
  var constants = require('constants');
  return require_circuits(Rx, _, utils, Err, constants);
});

function require_circuits(Rx, _, utils, Err, constants) {
  var SIMULATE_PORT_NAME = constants.SIMULATE_PORT_NAME;
  var READOUT_PORT_NAME = constants.READOUT_PORT_NAME;
  var COMMAND_PLUG_IN_CIRCUIT = constants.COMMAND_PLUG_IN_CIRCUIT;
  var COMMAND_UNPLUG_CIRCUIT = constants.COMMAND_UNPLUG_CIRCUIT;

  /**
   *
   * @param {Port} port
   * @constructor
   */
  function IN_Port(port) {
    this.chip_uri = port.chip_uri;
    this.port_name = port.port_name;
  }

  /**
   *
   * @param {Port} port
   * @constructor
   */
  function OUT_Port(port) {
    this.chip_uri = port.chip_uri;
    this.port_name = port.port_name;
  }

  function get_default_IN_conn() {return new Rx.Subject();}

  function get_default_OUT_conn() {return new Rx.Subject();}

  function get_default_simulate_conn() {return new Rx.Subject();}

  function get_default_readout_conn() {return new Rx.ReplaySubject(1);}

  function controller_transform(order$, settings) {
    var circuits_initial_state = settings;
    return {
      circuits_state$: order$
        .scan(process_order, circuits_initial_state)
    }
  }

  var controller_simulate_conn = get_default_simulate_conn();
  var controller_readout_conn = get_default_readout_conn();
  var controller_settings = {
    IN_connector_hash: new utils.Hashmap({}),
    OUT_connector_hash: new utils.Hashmap({})
  };

  var controller = {
    serie: 'controller',
    uri: 'controller_1',
    ports: {
      IN: ['order$'],
      OUT: ['circuits_state$']
    },
    transform: controller_transform,
    settings: controller_settings,
    test: {
      simulate: controller_simulate_conn,
      readout: controller_readout_conn
    }
  };

  function create_controller() {
    plug_in(controller, controller_settings);
    return controller;
  }

  /**
   *
   * @param {IN_Port | OUT_Port} port
   */
  function get_port_uri(port) {
    return utils.join(port.chip_uri, port.port_name);
  }

  function is_port_uri(port_uri) {
    return function is_port_uri(message) {
      return port_uri === get_uri_from_message(message);
    }
  }

  function get_uri_from_message(message) {
    // NOTE ; the encoding decided is to prefix the actual object passed by a property which is the uri sending the message
    //         So there should only be one such key in this object
    return utils.get_label(message);
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @returns {function (Port_Labelled_Message) : Port_Labelled_Message}
   */
  function translate_circuit_IN_port_uri(ports_map) {
    return function translate_circuit_IN_port_uri(port_labelled_message) {
      var IN_port_uri = utils.get_label(port_labelled_message);
      var translated_IN_port_uri = get_port_uri(ports_map.IN[IN_port_uri]);
      var translated_message = {};
      translated_message[translated_IN_port_uri] = utils.remove_label(port_labelled_message);
      return translated_message;
    }
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @returns {function (Port_Labelled_Message) : Port_Labelled_Message}
   */
  function translate_circuit_OUT_port_uri(ports_map) {
    return function translate_circuit_OUT_port_uri(port_labelled_message) {
      var OUT_port_uri = utils.get_label(port_labelled_message);
      var translated_OUT_port_uri = get_port_uri(ports_map.OUT[OUT_port_uri]);
      var translated_message = {};
      var readout = port_labelled_message[OUT_port_uri].readout;
      translated_message[translated_OUT_port_uri] = {
        timestamp: new Date(),
        readout: readout
      }
      return translated_message;
    }
  }

  /**
   *
   * @param {Rx.Subject} connector
   * @returns {Function}
   * @param {OUT_Port} port
   * Side-effects : None. But the returned function sends a message labelled with the port uri on the connector
   */
  function tap(connector, port) {
    return function tap(readout) {
      var port_uri = get_port_uri(port);
      var timestamp = new Date();
      var labelled_message = {};
      labelled_message[port_uri] = {
        timestamp: timestamp,
        readout: readout
      };
      connector.onNext(labelled_message);
    }
  }

  /**
   *
   * @param ports
   * @param circuits_state
   * @param uri
   * Side-effects : modify `circuits_state`
   */
  function register_IN_ports(ports, uri, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    ports.IN.forEach(function create_IN_connectors(port_name) {
      var port = new IN_Port({chip_uri: uri, port_name: port_name});
      var port_uri = get_port_uri(port);
      var connector = get_default_IN_conn();
      if (IN_connector_hash.get(port_uri)) throw 'There already exists a port with the same identifier!' // TODO : pass extended_info in error message
      IN_connector_hash.set(port_uri, connector);
    });
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @param {URI} uri
   * @param circuits_state
   * Side-effects : modifies `circuits_state`
   * @throws : if uri is not unique (exists already)
   */
  function register_circuit_OUT_ports(ports_map, uri, /*-OUT-*/circuits_state) {
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    _.forEach(ports_map.OUT, function create_OUT_connectors(__, port_name) {
      var port = new OUT_Port({chip_uri: uri, port_name: port_name});
      var port_uri = get_port_uri(port);
      var connector = get_default_OUT_conn();
      if (OUT_connector_hash.get(port_uri)) throw 'There already exists a port with the same identifier!' // TODO : pass extended_info in error message
      OUT_connector_hash.set(port_uri, connector);
    });
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @param {URI} uri
   * @param circuits_state
   * Side-effects : modifies `circuits_state`
   * @throws : if uri is not unique (exists already)
   */
  function register_circuit_IN_ports(ports_map, uri, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    _.forEach(ports_map.IN, function create_IN_connectors(__, port_name) {
      var port = new IN_Port({chip_uri: uri, port_name: port_name});
      var port_uri = get_port_uri(port);
      var connector = get_default_IN_conn();
      if (IN_connector_hash.get(port_uri)) throw 'There already exists a port with the same identifier!' // TODO : pass extended_info in error message
      IN_connector_hash.set(port_uri, connector);
    });
  }

  /**
   *
   * @param {Ports_Map} circuit_ports_map
   * @param circuits_state
   * @param circuit_uri
   * Side-effects : subscribes exposed circuit IN connectors to mapped inner chip/circuits IN connector
   */
  function connect_mapped_circuit_IN_ports(circuit_ports_map, circuit_uri, circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    _.forEach(circuit_ports_map.IN, function connect_mapped_circuit_IN_ports(target_IN_port, circuit_IN_port_name) {
      var circuit_IN_connector =
        IN_connector_hash.get(get_port_uri(new IN_Port({chip_uri: circuit_uri, port_name: circuit_IN_port_name})));
      var mapped_IN_connector = IN_connector_hash.get(get_port_uri(target_IN_port));
      circuit_IN_connector.subscribe(mapped_IN_connector);
    });
  }

  /**
   *
   * @param {Ports_Map} circuit_ports_map
   * @param {URI} circuit_uri
   * @param circuits_state
   * Side-effects : subscribes exposed circuit OUT connectors to mapped inner chip/circuits OUT connector
   */
  function connect_mapped_circuit_OUT_ports(circuit_ports_map, circuit_uri, circuits_state) {
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    _.forEach(circuit_ports_map.OUT, function connect_mapped_circuit_OUT_ports(target_OUT_port, circuit_OUT_port_name) {
      var mapped_OUT_connector = OUT_connector_hash.get(get_port_uri(target_OUT_port));
      var circuit_OUT_connector =
        OUT_connector_hash.get(get_port_uri(new OUT_Port({
          chip_uri: circuit_uri,
          port_name: circuit_OUT_port_name
        })));
      mapped_OUT_connector.subscribe(circuit_OUT_connector);
    });
  }

  /**
   *
   * @param {Array<Link>} links
   * @param {{IN_connector_hash : IN_Connector_Dict, OUT_connector_hash : OUT_Connector_Dict}} circuits_state
   * Side-effects : connects OUT connectors of one chip/circuit to mapped IN connector of another chip/circuit
   */
  function connect_links(links, circuits_state) {
    // 2. Wire links
    // - get IN_port, OUT_port from link
    // - get IN subject connector and OUT observable connector associated to link (from IN_Connector_Dict and OUT_Connector_Dict )
    //   + connector <- hashmap.get(IN_port)
    // - subscribe connector IN to connector OUT
    links.forEach(function (link) {
      var IN_connector_hash = circuits_state.IN_connector_hash;
      var OUT_connector_hash = circuits_state.OUT_connector_hash;
      var IN_port = link.IN_port;
      var OUT_port = link.OUT_port;
      var IN_connector = IN_connector_hash.get(get_port_uri(IN_port));
      var OUT_connector = OUT_connector_hash.get(get_port_uri(OUT_port));
      OUT_connector.subscribe(IN_connector);
    });
  }

  /**
   *
   * @param {Circuit|Chip} circuit
   * @param {{IN_connector_hash, OUT_connector_hash}} circuits_state
   * Side-effects : modifies `circuits_state` hashmaps
   */
  function plug_in(circuit, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var uri = circuit.uri;
    var circuit_chips = circuit.chips;
    var chip_ports = circuit.ports;
    var circuit_ports_map = circuit.ports_map;
    var circuit_links = circuit.links;
    var chip_settings = circuit.settings;
    var chip_transform = circuit.transform;
    var test = circuit.test;
    var simulate_conn = test.simulate;
    var readout_conn = test.readout;

    if (!circuit_chips) {
      // Case chip : (`chips` is undefined)
      // 1. Create and register IN_ports connectors
      register_IN_ports(chip_ports, uri, circuits_state);

      // 2. Register simulate connector
      // If there is no simulate connector, we create one.
      // We need one, so that if we have a simulate connector at a higher level (enclosing circuit),
      // that upper-level simulate connector can connect to the lower-level connector to send data
      // This done recursively in every level ensures an ininterrupted connector chain ending at the chip level.
      // Hence, the simulate connector at the chip level can forward data down to any other level.
      // The default connector is an Rx.Subject.
      // We should not need a replay functionality here as :
      // - the simulate connector is used by construction once all lower-level circuits are plugged
      // - there should only ever be one user/caller of a simulate connector (i.e. no concurrent simulations)
      simulate_conn = simulate_conn ? simulate_conn : get_default_simulate_conn();
      IN_connector_hash.set(get_port_uri({chip_uri: uri, port_name: SIMULATE_PORT_NAME}), simulate_conn);

      // 3. Add simulate functionality
      // This means passing simulate connector's input to each port, after filtering out input destined to other ports
      // NOTE : SIMULATE connectors do not send error notification if one sends messages relevant to no ports
      var merged_connectors = chip_ports.IN.map(function create_merged_connectors(port_name) {
        var port = new IN_Port({chip_uri: uri, port_name: port_name});
        var port_uri = get_port_uri(port);
        return Rx.Observable.merge(
          IN_connector_hash.get(port_uri),
          simulate_conn.filter(is_port_uri(port_uri)).map(utils.remove_label)
        );
      });

      //  4 Call the chip's transform function to process ports' inputs into outputs
      //  Edge case : there is no IN connector : `transform` in that case is called with [], that's fine
      if (!utils.is_function(chip_transform)) throw 'something' // TODO error message
      merged_connectors.push(chip_settings);
      var output = chip_transform.call(null, merged_connectors);

      // 5. Create and register OUT_ports
      // If there is no readout connector, we create one.
      // We need one, so that if we have a readout connector at a higher level (enclosing circuit),
      // that upper-level readout connector can connect to the lower-level connector to receive data
      // This done recursively in every level ensures an ininterrupted connector chain ending at the chip level.
      // Hence, the readout connector at the chip level can forward data up to any other level.
      // Default readout connector is a Rx.ReplaySubject(1) as while we are pluging in circuits and connecting
      // wires, data may be emitted before the readout connector to receive them.
      // In principle a replay(1) is sufficient. All pluging-in and wiring should happen in the same tick.
      readout_conn = readout_conn ? readout_conn : get_default_readout_conn();
      OUT_connector_hash.set(get_port_uri({chip_uri: uri, port_name: READOUT_PORT_NAME}), readout_conn);

      chip_ports.OUT.forEach(function create_OUT_connectors(port_name) {
        var port = new OUT_Port({chip_uri: uri, port_name: port_name});
        var connector = output[port_name];
        // OUT connector must be shared as it can have several IN ports subscribing to it
        // share is AFTER the readout side-effect, not to repeat it several times
        var readout$ = connector.do(tap(readout_conn, port)).share();
        OUT_connector_hash.set(get_port_uri(port), readout$);
      });
    }
    else {
      // Case circuit :
      // 1. Plug-in each child chip/circuit in order of definition
      circuit_chips.forEach(function (chip) {
        plug_in(chip, circuits_state);
      });

      // 2. Register circuit ports and link them to lower-level ports
      // Note : this has to be done prior to connecting the circuits links, as they might use the circuit IN_ports, and OUT_ports
      // Note : this has to be done after pluging-in the lower-level chips/circuits so their connectors are already created
      // and can be referred to.
      // 2a. IN_ports
      register_circuit_IN_ports(circuit_ports_map, uri, circuits_state);
      connect_mapped_circuit_IN_ports(circuit_ports_map, uri, circuits_state);
      // 2b. OUT_ports
      // NOTE : those OUT ports will be proxy subjects whose aim is to forward the content of existing inner-level OUT ports
      register_circuit_OUT_ports(chip_ports, uri, circuits_state);
      connect_mapped_circuit_OUT_ports(circuit_ports_map, uri, circuits_state);

      // 3. Wire links
      connect_links(circuit_links, circuits_state);

      // 4. Connect and register simulate connector
      //   If !circuit.test.simulate, create one default (Rx.Subject) and set it up on the object
      //   Connect SIMULATE connector to ALL children chips
      //   NOTE : Circuits' simulate connector differ from chips' simulate connector:
      //   - They propagate messages to all given circuit's members, even if there is no corresponding exposed port
      //   - This is better for testing purposes which is the goal of the simulate connector in the first place
      //   - For instance, if we have a circuit representing a DOM component having an intent source chip,
      //     it will be possible to simulate the intents from the circuit's simulate connector, even as there is no exposed
      //     port to the intent source chip.
      //   NOTE : this works because all ports are filtering by port_uri, so no risk of pollution
      var circuit_simulate_conn = circuit.test.simulate = simulate_conn ? simulate_conn : get_default_simulate_conn();
      // NOTE : It is not really necessary to register also the simulate connectors,
      // unless we want to access them from out-of-scope parts of the programs OR we change the API and choose not
      // to reference the chip object directly (as in chip.test.simulate), but instead its uri
      IN_connector_hash.set(get_port_uri({chip_uri: uri, port_name: SIMULATE_PORT_NAME}), circuit_simulate_conn);
      circuit_chips.forEach(function connect_circuit_simulate_to_chips(chip) {
        circuit_simulate_conn
          // NOTE : when passing a message from one port to a lower-level one, we must translate the message label
          .map(translate_circuit_IN_port_uri(circuit_ports_map))
          .subscribe(chip.test.simulate);
      });

      // 5. Connect and register readout connector
      //   If !circuit.test.readout, create one default (Rx.ReplaySubject(1)) and set it up on the object
      //   Connect ALL children chips connectors to READOUT connector
      var circuit_readout_conn = circuit.test.readout = readout_conn ? readout_conn : get_default_readout_conn();
      OUT_connector_hash.set(get_port_uri({chip_uri: uri, port_name: READOUT_PORT_NAME}), circuit_readout_conn);
      circuit_chips.forEach(function connect_circuit_readout_to_chips(chip) {
        chip.test.readout
          .map(translate_circuit_OUT_port_uri(circuit_ports_map))
          .subscribe(circuit_readout_conn);
      });

    }
    // CONTRACT : SIMULATE_PORT_NAME and READOUT_PORT_NAME are reserved names (but they start with $) so let's say no names start with $
  }

  /**
   *
   * @param circuits_state
   * @param {Controller_Order} order
   * @returns {*}
   */
  function process_order(circuits_state, order) {
    var order_command = get_order_command(order);
    /**@type {{circuit: Circuit|Chip, links : Array<Link>}}*/
    var order_parameters = get_order_parameters(order);

    switch (order_command) {
      case COMMAND_PLUG_IN_CIRCUIT :
        // Case : we have a circuit that we want to plug-in and START (essentially equivalent terms in this context)
        var circuit = order_parameters.circuit; // Note : could also be a chip
        var links = order_parameters.links;
        // The circuit already has ample information as how to connect inward.
        // The `links` property allows to :
        // - connect to the controller, using the controller connector's uri which 'manages' the chip
        // - connect outwards, for instance to plug-in the circuit to prior existing circuits

        plug_in(circuit, /*-OUT-*/circuits_state);
        // 2. Connect links
        connect_links(links, circuits_state);
        // There is no simulate and readout here, they are at the circuit level

        // TODO : Write the TDD for the three tests I have already written
        // 0. Test creation and starting of the controller and receiving output
        // 1. just a chip, 2 IN, 1 OUT
        // 2. just one 1 circuit, 2 chips, 2 -> 1
        //    Chips : [1,2]
        //    Chip 2 : 2 IN, 1 OUT : A,
        //    Chip 1 : 1 IN : A', 0 OUT
        //    Links : A' -> A
        // 3. 1 circuit (same as before), 1 one chip
        //    a. Two create orders : 1. circuit (same as before), 2. chip connected to circuit
        //    CHECK THE SIMULATE PORTION
        // TODO : write TDD tests for readouts

        break;
      case COMMAND_UNPLUG_CIRCUIT :
        break;
      default :
        throw 'kuvgkj'; // TODO : error message
    }

    return circuits_state;

    function get_order_command(order) {
      return order.command;
    }

    function get_order_parameters(order) {
      return order.parameters;
    }
  }

  return {
    create_controller: create_controller
  }
}
