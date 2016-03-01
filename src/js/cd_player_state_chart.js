function require_cd_player_def(cd_player, utils) {
    // Object exposing APIs used by the GUI
    //    var cd_player = require_cd_player(utils);
    var fsm = require_async_fsm(utils);

    const FORWARD_INTERVAL = 250;
    const TOOLTIP_PLAY_BUTTON_PLAY = 'Play';
    const TOOLTIP_PAUSE_BUTTON_PAUSE = 'Pause';
    const TOOLTIP_EJECT_BUTTON_EJECT = 'Eject';
    const TOOLTIP_PLAY_BUTTON_RESUME = 'Resume';
    const TOOLTIP_PAUSE_BUTTON_RESUME = 'Resume';
    const TOOLTIP_EJECT_BUTTON_CLOSE = 'Close';

    // Model definition
    var model = {
        cd_in_drawer: true,
        current_track$: undefined,
        current_cd_play_time$: 0, //in s
        last_track: undefined,
        forward_timer_id: undefined,
        backward_timer_id: undefined,
        end_of_cd: false,
        hiddenS: undefined,
        hidden$: undefined,
        play_tooltip: '',
        pause_tooltip: '',
        eject_tooltip: ''
    };

    // States definition
    var cd_player_states = {
        no_cd_loaded: {
            cd_drawer_closed: '', cd_drawer_open: '', closing_cd_drawer: ''
        },
        cd_loaded: {
            cd_loaded_group: {
                cd_paused_group: {
                    time_and_track_fields_not_blank: '', time_and_track_fields_blank: ''
                },
                cd_playing: '',
                cd_stopped: ''
            },
            stepping_forwards: '',
            stepping_backwards: ''
        }
    };
    var states = fsm.build_state_enum(cd_player_states);

    // Events definition
    var cd_player_events = fsm.create_event_enum([
        'eject', 'pause', 'play', 'stop', 'timer_expired', 'next_track', 'previous_track',
        'forward_up', 'forward_down', 'reverse_down', 'reverse_up'
    ]);

    // Predicates
    function is_cd_in_drawer(model, event_data) {
        return model.cd_in_drawer;
    }

    function is_not_cd_in_drawer(model, event_data) {
        return !model.cd_in_drawer;
    }

    function is_end_of_cd(model, event_data) {
        return cd_player.is_end_of_cd();
    }

    function is_not_end_of_cd(model, event_data) {
        return !is_end_of_cd();
    }

    function is_last_track(model, event_data) {
        return model.current_track >= model.last_track;
    }

    function is_track_gt_1(model, event_data) {
        return model.current_track > 1;
    }

    function is_track_eq_1(model, event_data) {
        return model.current_track === 1;
    }

    function is_not_last_track(model, event_data) {
        return !is_last_track(model, event_data);
    }

    // Helpers Function used by several actions
    function stop(model) {
        cd_player.stop('stopping...');
        model.hiddenS.onNext(true);
        model.play_tooltip = TOOLTIP_PLAY_BUTTON_PLAY;
        model.pause_tooltip = TOOLTIP_PAUSE_BUTTON_PAUSE;
        return model;
    }

    // Actions
    function fsm_initialize_model(model) {
        var cd_player_streams = cd_player.get_playing_streams(cd_player.get_current_track(), cd_player.get_current_time());
        model.current_track$ = cd_player_streams.current_track$;
        model.current_cd_play_time$ = cd_player_streams.current_time$;
        model.current_track = model.current_track$.subscribe(utils.update_prop(model, 'current_track'));
        model.current_cd_play_time = model.current_cd_play_time$.subscribe(utils.update_prop(model, 'current_cd_play_time'));
        model.hiddenS = new Rx.BehaviorSubject(true);
        model.hidden$ = model.hiddenS // subject to toggle the hidden$ observable
            .flatMapLatest(function (flag) {
                return flag
                    ? Rx.Observable.return('visible')
                    : Rx.Observable.interval(500).map(toggle_visibility)
            })
            .share()
            .do(utils.rxlog('visibility'));
        model.last_track = cd_player.get_last_track();
        model.play_tooltip = TOOLTIP_PLAY_BUTTON_PLAY;
        model.pause_tooltip = TOOLTIP_PAUSE_BUTTON_PAUSE;
        model.eject_tooltip = TOOLTIP_EJECT_BUTTON_EJECT;

        return model;
    }

    function open_drawer(model, event_data) {
        cd_player.open_drawer('opening drawer...');
        model.eject_tooltip = TOOLTIP_EJECT_BUTTON_EJECT;
        return model;
    }

    function close_drawer(model, event_data) {
        cd_player.close_drawer('closing drawer...');
        model.eject_tooltip = TOOLTIP_EJECT_BUTTON_CLOSE;
        return model;
    }

    function play(model, event_data, fsm, cd_player_events) {
        var initial_track = 1;
        var initial_cd_play_time = 0;

        var cd_player_streams = cd_player.play(cd_player.get_current_track() || initial_track, cd_player.get_current_time() || initial_cd_play_time);
        //update_play_time(model, event_data, fsm, cd_player_events);
        // Here, for the sake of demonstration we use a stream directly returned by the cd_player
        // But it would be the same principle if data were coming on a websocket, just that
        // we would have to create the observable in the function through Rx.Observable.create, wrapping the websocket
        model.current_track$ = model.current_track$ || cd_player_streams.current_track$;
        model.current_cd_play_time$ = model.current_cd_play_time$ || cd_player_streams.current_time$;
        model.play_tooltip = TOOLTIP_PLAY_BUTTON_PLAY;
        return model;
    }

    function poll_play_time(model, event_data, fsm, cd_player_events) {
        return update_play_time(model, event_data, fsm, cd_player_events);
    }

    function eject(model, event_data) {
        var model_prime = stop(model);
        cd_player.open_drawer('opening drawer...');
        return model_prime;
    }

    function go_next_track(model, event_data, fsm, cd_player_events) {
        cd_player.next_track('going to next track...');
        return model;
    }

    function go_track_1(model, event_data, fsm, cd_player_events) {
        cd_player.go_track(1);
        return model;
    }

    function go_previous_track(model, event_data, fsm, cd_player_events) {
        cd_player.previous_track();
        return model;
    }

    function toggle_visibility(x) {
        return (x % 2 === 0) ? 'hidden' : 'visible'
    }

    function pause_playing_cd(model, event_data, fsm, cd_player_events) {
        cd_player.pause();
        model.hiddenS.onNext(false);
        model.pause_tooltip = TOOLTIP_PAUSE_BUTTON_RESUME;
        model.play_tooltip = TOOLTIP_PLAY_BUTTON_RESUME;
        /*
         model.hidden$ = model.hidden$ || model.hiddenS // subject to toggle the hidden$ observable
         .flatMapLatest(function (flag) {
         return flag
         ? Rx.Observable.return('visible').do(function (x) {
         console.log("visibility", x)
         })
         : Rx.Observable.interval(500).map(toggle_visibility).share()
         })
         .do(function (x) {
         console.log("visibility", x)
         });
         */
        return model;
    }

    function resume_paused_cd(model, event_data, fsm, cd_player_events) {
        model.hiddenS.onNext(true);
        model.pause_tooltip = TOOLTIP_PAUSE_BUTTON_PAUSE;
        model.play_tooltip = TOOLTIP_PLAY_BUTTON_PLAY;
        return play(model, event_data, fsm, cd_player_events);
    }

    function go_forward_1_s(model, event_data, fsm, cd_player_events) {
        // NOTE : we have to put this first line to cancel other timers that could conflict
        // This could be put into entry and exit state actions once we have implemented that
        // That would be cleaner as we should not care about previous state here
        cd_player.forward_1_s();
        //        model = update_play_time(model, event_data, fsm, cd_player_events);
        //        model.forward_timer_id = create_timer('forward_timer', 250);
        return model;
    }

    function go_backward_1_s(model, event_data, fsm, cd_player_events) {
        cd_player.backward_1_s();
        //        update_play_time(model, event_data, fsm, cd_player_events);
        //        model.backward_timer_id = create_timer('backward_timer', 250);
        return model;
    }

    // Action list
    var action_list = [
        fsm_initialize_model,
        open_drawer,
        close_drawer,
        play,
        stop,
        poll_play_time,
        eject,
        go_next_track,
        go_track_1,
        go_previous_track,
        pause_playing_cd,
        resume_paused_cd,
        go_forward_1_s,
        go_backward_1_s
    ];

    var action_struct = fsm.make_action_DSL(action_list);
    var action_enum = action_struct.action_enum;

    // Transitions
    var cd_player_transitions = [
        {from: states.NOK, to: states.no_cd_loaded, event: cd_player_events.INIT, action: action_enum.fsm_initialize_model},
        {from: states.no_cd_loaded, to: states.cd_drawer_closed, event: cd_player_events.INIT, action: action_enum.open_drawer},
        {from: states.cd_drawer_closed, to: states.cd_drawer_open, event: cd_player_events.EJECT, action: action_enum.close_drawer},
        {from: states.cd_drawer_open, to: states.closing_cd_drawer, event: cd_player_events.EJECT, action: action_enum.identity},
        {from: states.closing_cd_drawer, conditions: [
            {condition: is_not_cd_in_drawer, to: states.cd_drawer_closed, action: action_enum.identity},
            {condition: is_cd_in_drawer, to: states.cd_loaded, action: action_enum.identity}
        ]},
        {from: states.cd_loaded, to: states.cd_loaded_group, event: cd_player_events.INIT, action: action_enum.identity},
        {from: states.cd_playing, to: states.cd_paused_group, event: cd_player_events.PAUSE, action: action_enum.pause_playing_cd},
        {from: states.cd_paused_group, to: states.cd_playing, event: cd_player_events.PAUSE, action: action_enum.resume_paused_cd},
        {from: states.cd_paused_group, to: states.cd_playing, event: cd_player_events.PLAY, action: action_enum.resume_paused_cd},
        {from: states.cd_paused_group, to: states.time_and_track_fields_not_blank, event: cd_player_events.INIT, action: action_enum.identity},
        {from: states.time_and_track_fields_not_blank, to: states.time_and_track_fields_blank, event: cd_player_events.TIMER_EXPIRED, action: action_enum.create_pause_timer},
        {from: states.time_and_track_fields_blank, to: states.time_and_track_fields_not_blank, event: cd_player_events.TIMER_EXPIRED, action: action_enum.create_pause_timer},
        {from: states.cd_paused_group, to: states.cd_stopped, event: cd_player_events.STOP, action: action_enum.stop},
        {from: states.cd_stopped, to: states.cd_playing, event: cd_player_events.PLAY, action: action_enum.play},
        {from: states.cd_playing, to: states.cd_stopped, event: cd_player_events.STOP, action: action_enum.stop},
        {from: states.cd_loaded_group, to: states.cd_stopped, event: cd_player_events.INIT, action: action_enum.stop},
        {from: states.cd_loaded_group, event: cd_player_events.NEXT_TRACK, conditions: [
            {condition: is_last_track, to: states.cd_stopped, action: action_enum.stop},
            {condition: is_not_last_track, to: states.history.cd_loaded_group, action: action_enum.go_next_track}
        ]},
        {from: states.cd_loaded_group, event: cd_player_events.PREVIOUS_TRACK, conditions: [
            {condition: is_track_gt_1, to: states.history.cd_loaded_group, action: action_enum.go_previous_track},
            {condition: is_track_eq_1, to: states.history.cd_loaded_group, action: action_enum.go_track_1}
        ]},
        {from: states.cd_loaded, to: states.cd_drawer_open, event: cd_player_events.EJECT, action: action_enum.eject},
        {from: states.stepping_forwards, event: cd_player_events.TIMER_EXPIRED, conditions: [
            {condition: is_not_end_of_cd, to: states.stepping_forwards, action: action_enum.go_forward_1_s},
            {condition: is_end_of_cd, to: states.cd_stopped, action: action_enum.stop}
        ]},
        {from: states.stepping_forwards, to: states.history.cd_loaded_group, event: cd_player_events.FORWARD_UP, action: action_enum.stop_forward_timer},
        {from: states.cd_loaded_group, to: states.stepping_forwards, event: cd_player_events.FORWARD_DOWN, action: action_enum.go_forward_1_s},
        {from: states.stepping_backwards, to: states.stepping_backwards, event: cd_player_events.TIMER_EXPIRED, action: action_enum.go_backward_1_s},
        {from: states.stepping_backwards, to: states.history.cd_loaded_group, event: cd_player_events.REVERSE_UP, action: action_enum.stop_backward_timer},
        {from: states.cd_loaded_group, to: states.stepping_backwards, event: cd_player_events.REVERSE_DOWN, action: action_enum.go_backward_1_s}
    ];

    return {
        model: model,
        action_list: action_list,
        action_hash: action_struct.action_hash,
        cd_player_states: cd_player_states,
        cd_player_events: cd_player_events,
        cd_player_transitions: cd_player_transitions,
        FORWARD_INTERVAL: FORWARD_INTERVAL
    }
}
