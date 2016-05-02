/**
 * HashMap - HashMap Class for JavaScript
 * @author Ariel Flesler <aflesler@gmail.com>
 * @version 2.0.5
 * Homepage: https://github.com/flesler/hashmap
 */

(function(factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof module === 'object') {
    // Node js environment
    var HashMap = module.exports = factory();
    // Keep it backwards compatible
    HashMap.HashMap = HashMap;
  } else {
    // Browser globals (this is window)
    this.HashMap = factory();
  }
}(function() {

  function HashMap(other, options) {
    this.clear();
    options && options.enable_set_data_structure && (this.enable_set_data_structure = !!options.enable_set_data_structure);
    if (!other) return;
    switch (arguments.length) {
      case 0: break;
      case 1:
      case 2 : this.copy(other); break;
      default: multi(this, arguments); break;
    }
  }

  var proto = HashMap.prototype = {
    constructor:HashMap,

    get:function(key) {
      var data = this._data[this.hash(key)];
      return data && data[1];
    },

    set:function(key, value) {
      // Store original key as well (for iteration)
      if (this.enable_set_data_structure && Object.keys(this._data).length !== 0){
        // key is already in the hashmap
        throw 'Hashmap.set : key already in hashmap!'
      }

      var hash = this.hash(key);
      if ( !(hash in this._data) ) {
        this._count++;
      }
      this._data[hash] = [key, value];
    },

    multi:function() {
      multi(this, arguments);
    },

    copy:function(other) {
      for (var hash in other._data) {
        if ( !(hash in this._data) ) {
          this._count++;
        }
        this._data[hash] = other._data[hash];
        other.enable_set_data_structure && (this.enable_set_data_structure = other.enable_set_data_structure);
      }
    },

    has:function(key) {
      return this.hash(key) in this._data;
    },

    search:function(value) {
      for (var key in this._data) {
        if (this._data[key][1] === value) {
          return this._data[key][0];
        }
      }

      return null;
    },

    remove:function(key) {
      var hash = this.hash(key);
      if ( hash in this._data ) {
        this._count--;
        delete this._data[hash];
      }
    },

    type:function(key) {
      var str = Object.prototype.toString.call(key);
      var type = str.slice(8, -1).toLowerCase();
      // Some browsers yield DOMWindow for null and undefined, works fine on Node
      if (type === 'domwindow' && !key) {
        return key + '';
      }
      return type;
    },

    keys:function() {
      var keys = [];
      this.forEach(function(_, key) { keys.push(key); });
      return keys;
    },

    values:function() {
      var values = [];
      this.forEach(function(value) { values.push(value); });
      return values;
    },

    count:function() {
      return this._count;
    },

    clear:function() {
      this._data = {};
      this._count = 0;
    },

    clone:function() {
      return new HashMap(this);
    },

    hash:function(key) {
      switch (this.type(key)) {
        case 'undefined':
        case 'null':
        case 'boolean':
        case 'number':
        case 'regexp':
          return key + '';

        case 'date':
          return '?' + key.getTime();

        case 'string':
          return '?' + key;

        case 'array':
          var hashes = [];
          for (var i = 0; i < key.length; i++) {
            hashes[i] = this.hash(key[i]);
          }
          return '?' + hashes.join('?');

        default:
          // TODO: Don't use expandos when Object.defineProperty is not available?
          if (!key.hasOwnProperty('_hmuid_')) {
            key._hmuid_ = ++HashMap.uid;
            hide(key, '_hmuid_');
          }

          return '?' + key._hmuid_;
      }
    },

    forEach:function(func, ctx) {
      for (var key in this._data) {
        var data = this._data[key];
        func.call(ctx || this, data[1], data[0]);
      }
    }
  };

  HashMap.uid = 0;
  HashMap.prototype.shallow_copy = HashMap.prototype.copy;

  //- Automatically add chaining to some methods

  for (var method in proto) {
    // Skip constructor, valueOf, toString and any other built-in method
    if (method === 'constructor' || !proto.hasOwnProperty(method)) {
      continue;
    }
    var fn = proto[method];
    if (fn.toString().indexOf('return ') === -1) {
      proto[method] = chain(fn);
    }
  }

  //- Utils

  function multi(map, args) {
    for (var i = 0; i < args.length; i += 2) {
      map.set(args[i], args[i+1]);
    }
  }

  function chain(fn) {
    return function() {
      fn.apply(this, arguments);
      return this;
    };
  }

  function hide(obj, prop) {
    // Make non iterable if supported
    if (Object.defineProperty) {
      Object.defineProperty(obj, prop, {enumerable:false});
    }
  }

  return HashMap;
}));
