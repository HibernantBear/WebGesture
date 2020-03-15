export function array_rm(array: Array<any>, item: any) {
    let index = array.indexOf(item);
    if (index < 0) {
        console.error("the item: " + item + " you try to remove in array: " + array + " not exist!");
        return;
    }
    array.splice(index, 1);
}

export function array_has(arr: Array<any>, target: any) {
    for (const item of arr) {
        if (item == target) return true;
    }
    return false;
}

export class Vector2D {
    constructor(public x: number = 0, public y: number = 0) {
    }
    static distence(a: Vector2D, b: Vector2D): number {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    }
    static offset(delta: Vector2D): number {
        return Math.sqrt(delta.x ^ 2 + delta.y ^ 2);
    }
    static delta(a: Vector2D, b: Vector2D): Vector2D {
        return { x: b.x - a.x, y: b.y - a.y };
    }
    static theta(a: Vector2D, b: Vector2D): number {
        return Math.atan2(b.y - a.y, b.x - a.x);
    }
}

export enum EVENT_STATUS {
    NONE = 0,
    START = 1,
    MOVE = 1 << 1,
    END = 1 << 2,
    CANCEL = 1 << 3,
}

export enum PROCESS_STATUS {
    NONE = 0,
    START = 1,
    WAIT = 1 << 1,
    ACTIVE = 1 << 2,
    HANDLED = 1 << 3,
    END = 1 << 4,
    CANCEL = 1 << 5,
}

const type2status = {
    "pointerdown": EVENT_STATUS.START,
    "pointermove": EVENT_STATUS.MOVE,
    "pointerup": EVENT_STATUS.END,
    "pointercancel": EVENT_STATUS.CANCEL,

}

export enum POINTER_TYPE {
    UNKNOWN = 0,
    MOUSE = 1,
    TOUCH = 2,
    STYLUS = 4,
}

export enum GESTURE_TYPE {
    UNKNOWN = 0,
    TAP = 1,
    PRESS = 1 << 1,
    PAN = 1 << 2,
    PINCH = 1 << 3,
    SWIPE = 1 << 4,
}

export enum DIRECTION {
    NONE = 0,
    UP = 1,
    DOWN = 1 << 1,
    LEFT = 1 << 2,
    RIGHT = 1 << 3,
    HORIZONTAL = DIRECTION.LEFT | DIRECTION.RIGHT,
    VERTICAL = DIRECTION.UP | DIRECTION.DOWN,
    ALL = DIRECTION.HORIZONTAL | DIRECTION.VERTICAL,
}

export class InputData {
    constructor(
        // pointers: Array<PointerEvent>;
        public event: string = "",  // event identify string
        public path: Array<Element> = Array(0),  // event src element
        public time: number = 0,
        public gesture: GESTURE_TYPE = 0,
        public type: POINTER_TYPE = 0,  // input pointer type
        public status: EVENT_STATUS = 0,  // input status
        public delta: Vector2D = { x: 0, y: 0 },  // delta of the input compare with the start point
        public theta: number = 0,
        public direction: DIRECTION = 0,
        public distence: number = 0,  // distence between initial pointer and now
        public duration: number = 0,  // duration between initial pointer and now
        public center: Vector2D = { x: 0, y: 0 },  // center of input data, meaningful when more than two pointers
        public speed: number = 0,  // speed of the pointer center moving, in differential
        public angle: number = 0,  // angle of the input data, only available with two or more pointers
        public diameter: number = 0,  // diameter of the cycle based on input pointers, only available with two and three pointers
        public pressure: number = 0,  // only available with stylus
        public tile: Vector2D = { x: 0, y: 0 },  // only available with stylus support tile
    ) { }
}

export interface Rule {
    event?: string;
    loop?: number;
}

export interface Matcher {
    global: boolean;
    // event_id: string;
    rule?: Rule;
    // handlers: Handlers;
    counter?: number;
    next?: Matcher;
    // add(handler: Function);
    // rm(handler: Function);
    match(watcher: Watcher, events: Events, data: InputData): PROCESS_STATUS;
    reset(): void;
}

export type Handlers = Array<Function>;

export type Events = {
    (event_name: string): Handlers;
}

export enum MATCH_TYPE {
    INSTANT = 0,
    CONTINUOUS = 1,
}

class MatcherBase {
    global: boolean = false;
    private match_type: MATCH_TYPE;
    protected event_id: string;
    protected default_event: boolean = true;
    constructor(match_type: MATCH_TYPE, event_id: string, default_event_id: string) {
        this.match_type = match_type;
        if (event_id && event_id != default_event_id) {
            this.default_event = false;
            this.event_id = event_id;
        }
        else this.event_id = default_event_id;
    }

    static _emit(events: Events, event_id: string, data: InputData) {
        let handlers = events[event_id];
        if (handlers) {
            for (const handler of handlers) {
                handler(data);
            }
        }
    }

    emit(events: Events, data: InputData, extra_events?: Array<string>) {
        // default event part;
        if (this.default_event) {
            // event trigger collections
            // extra event part
            if (extra_events && extra_events.length > 0) {
                for (const item of extra_events) {
                    MatcherBase._emit(events, MatcherBase.event_string(this.event_id, item), data);
                }
            }
            // default status event trigger
            MatcherBase._emit(events, MatcherBase.event_string(this.event_id, EVENT_STATUS[data.status]), data);
            // such as "TAP" means "TAP_END", "PAN" means "PAN_START PAN_MOVE PAN_END PAN_CANCEL"
            if (this.match_type == MATCH_TYPE.CONTINUOUS || this.match_type == MATCH_TYPE.INSTANT && data.status == EVENT_STATUS.END) MatcherBase._emit(events, this.event_id, data);
        }
        else {
            MatcherBase._emit(events, this.event_id, data);
        }
    }

    protected static init_rule(rule: object, rule_default: object) {
        let result = Object.assign({}, rule_default);
        return Object.assign(result, rule);
    }
    protected static event_string(base: string, postfix: string) {
        return base + "_" + postfix;
    }
    protected static extra_event_direction(data: InputData) {
        let result = Array();
        for (let i = 0; i < 4; i++) {
            if (data.direction & (1 << i)) result.push(DIRECTION[1 << i]);
        }
        return result;
    }
}

export class MatcherFocusBlur implements Matcher {
    global = true;
    private status: PROCESS_STATUS = PROCESS_STATUS.NONE;
    constructor() { }

    match(watcher: Watcher, events: Events, data: InputData) {
        // console.log(watcher.inst, data);
        if (array_has(data.path, watcher.inst)) {
            if (this.status == PROCESS_STATUS.NONE) {
                this.status = PROCESS_STATUS.ACTIVE;
                // console.log("FOCUS");
                MatcherBase._emit(events, "FCOUS", data);
            }
        }
        else if (this.status == PROCESS_STATUS.ACTIVE) {
            this.status = PROCESS_STATUS.END;
            // console.log("BLUR");
            MatcherBase._emit(events, "BLUR", data);
        }
        return this.status;
    }

    reset() {
        this.status = PROCESS_STATUS.NONE;
    }

}

export interface RuleTap extends Rule {
    interval?: number;
    duration?: number;
    taps?: number;
    threshold?: number;
    pointers?: number;
    tolerance?: number;
}

export class MatcherTap extends MatcherBase implements Matcher {
    static rule_default: RuleTap = {
        event: "TAP",
        interval: 250,
        duration: 250,
        taps: 1,
        threshold: 10,
        pointers: 1,
        tolerance: 10,
    }
    private start: InputData;
    private end: InputData;
    rule: RuleTap;
    next: Matcher;
    constructor(
        rule?: RuleTap,
    ) {
        super(MATCH_TYPE.INSTANT, rule && rule.event, MatcherTap.rule_default.event);
        this.rule = MatcherBase.init_rule(rule, MatcherTap.rule_default);
    }

    match(wathcer: Watcher, events: Events, data: InputData) {
        if (data.status & EVENT_STATUS.START) this.start = data;
        if (data.status & EVENT_STATUS.END) this.end = data;
        if (
            (data.status & EVENT_STATUS.END) &&
            (data.distence < this.rule.threshold) &&
            (data.duration < this.rule.duration)
        ) {
            data.gesture |= GESTURE_TYPE.TAP;
            this.emit(events, data);
            return PROCESS_STATUS.HANDLED | PROCESS_STATUS.END;
        }
        if (data.status & (EVENT_STATUS.END | EVENT_STATUS.CANCEL)) return PROCESS_STATUS.END;
        return PROCESS_STATUS.WAIT;
    }

    reset() {
        this.start = undefined;
        this.end = undefined;
    }
}

export interface RulePress extends Rule {
    auto?: boolean;
    time?: number;
    threshold?: number;
    pointers?: number;
}

export class MatcherPress extends MatcherBase implements Matcher {
    static rule_default: RulePress = {
        event: "PRESS",
        auto: false,
        time: 251,
        threshold: 10,
        pointers: 1,
    }
    private start: InputData;
    private timer;
    rule: RulePress;
    constructor(
        rule?: RulePress,
    ) {
        super(MATCH_TYPE.INSTANT, rule && rule.event, MatcherPress.rule_default.event);
        this.rule = MatcherBase.init_rule(rule, MatcherPress.rule_default);
    }

    match(wathcer: Watcher, events: Events, data: InputData) {
        if (data.status & EVENT_STATUS.START) this.start = data;
        if (
            this.start &&
            (data.distence < this.rule.threshold)
        ) {
            if (!(data.status & EVENT_STATUS.CANCEL) &&
                data.duration > this.rule.time) {
                data.gesture |= GESTURE_TYPE.PRESS;
                this.emit(events, data);
                this.start = undefined;
                let status = PROCESS_STATUS.HANDLED;
                if (data.status & EVENT_STATUS.END) status |= PROCESS_STATUS.END;
                else status |= PROCESS_STATUS.ACTIVE;
                return status;
            }
            if (this.rule.auto && !(data.status & (EVENT_STATUS.END | EVENT_STATUS.CANCEL))) {
                this.clear_timer();
                this.timer = setTimeout(() => {
                    data.gesture |= GESTURE_TYPE.PRESS;
                    data.status = EVENT_STATUS.END;
                    this.emit(events, data);
                    this.start = undefined;
                    // console.log("trigger timer");
                }, this.rule.time - data.duration);
            }
        }
        if (data.status & (EVENT_STATUS.END | EVENT_STATUS.CANCEL)) {
            this.clear_timer();
            return PROCESS_STATUS.END;
        }
        return PROCESS_STATUS.WAIT;
    }
    clear_timer() {
        this.timer && clearTimeout(this.timer);
        this.timer = undefined;
    }
    reset() {
        this.start = undefined;
        this.clear_timer();
    }
}

export interface RulePan extends Rule {
    threshold?: number;
    pointers?: number;
    direction?: DIRECTION;
}

export class MatcherPan extends MatcherBase implements Matcher {
    static rule_default: RulePan = {
        event: "PAN",
        threshold: 10,
        pointers: 1,
        direction: DIRECTION.ALL,
    }
    private start: InputData;
    rule: RulePan;
    constructor(
        rule?: RulePan,
    ) {
        super(MATCH_TYPE.CONTINUOUS, rule && rule.event, MatcherPan.rule_default.event);
        this.rule = MatcherBase.init_rule(rule, MatcherPan.rule_default);
    }

    match(wathcer: Watcher, events: Events, data: InputData) {
        if (data.status & EVENT_STATUS.START) this.start = data;
        if (!this.start || data.distence > this.rule.threshold) {
            if (
                data.status &&
                (data.direction & this.rule.direction)
            ) {
                data.gesture |= GESTURE_TYPE.PAN;
                if (this.start) {
                    this.emit(events, this.start);
                    this.start = undefined;
                }
                this.emit(events, data, MatcherBase.extra_event_direction(data));
                let status = PROCESS_STATUS.HANDLED;
                if (data.status & (EVENT_STATUS.END | EVENT_STATUS.CANCEL)) status |= PROCESS_STATUS.END;
                else status |= PROCESS_STATUS.ACTIVE;
                return status;
            }
        }
        if (data.status & (EVENT_STATUS.END | EVENT_STATUS.CANCEL)) return PROCESS_STATUS.END;
        return PROCESS_STATUS.WAIT;
    }
    reset() {
        this.start = undefined;
    }
}

export interface RuleSwipe extends Rule {
    threshold?: number;
    pointers?: number;
    velocity?: number;  // pixels per ms
    direction?: DIRECTION;
}

export class MatcherSwipe extends MatcherBase implements Matcher {
    static rule_default: RuleSwipe = {
        event: "SWIPE",
        threshold: 10,
        pointers: 1,
        velocity: 0.3,
        direction: DIRECTION.ALL,
    }
    rule: RuleSwipe;
    constructor(
        rule?: RuleSwipe,
    ) {
        super(MATCH_TYPE.INSTANT, rule && rule.event, MatcherSwipe.rule_default.event);
        this.rule = MatcherBase.init_rule(rule, MatcherSwipe.rule_default);
    }

    match(wathcer: Watcher, events: Events, data: InputData) {
        if (
            (data.status & EVENT_STATUS.END) &&
            (data.distence > this.rule.threshold) &&
            (data.direction & this.rule.direction) &&
            (data.distence / data.duration > this.rule.velocity)
        ) {
            data.gesture |= GESTURE_TYPE.SWIPE;
            this.emit(events, data, MatcherBase.extra_event_direction(data));
            return PROCESS_STATUS.HANDLED | PROCESS_STATUS.END;
        }
        if (data.status & (EVENT_STATUS.END | EVENT_STATUS.CANCEL)) return PROCESS_STATUS.END;
        return PROCESS_STATUS.WAIT;
    }
    reset() { }
}

export interface ConfigWatcher {
    block?: WATCHER_BLOCK,
    direction?: "mutex" | "tolerant";
    global?: boolean;
    share?: boolean;  // share the watcher object for mem saving
}

export enum WATCHER_BLOCK {
    AUTO = 1,
    SELF = 1 << 1,
    OTHERS = 1 << 2,
    ALL = SELF | OTHERS,
    ONCE = 1 << 3,
}

const MARK_HANDLED = "h_input_handled";
const MARK_WATCHER = "h_watcher";

export class Watcher {
    static config_default: ConfigWatcher = {
        block: WATCHER_BLOCK.AUTO,
        direction: "tolerant",
        global: false,  // this must be set to true for FOCUS and BLUR event
        share: true,
    }
    static find_watcher(inst: HTMLElement | Document) {
        return inst[MARK_WATCHER];
    }
    static root_watcher: boolean = false;

    public inst: HTMLElement;
    private counter: number = 0;
    private status: PROCESS_STATUS = PROCESS_STATUS.NONE;
    private status_global: PROCESS_STATUS = PROCESS_STATUS.NONE;
    private config: ConfigWatcher;
    private start: InputData;
    private matchers: Array<Matcher> = Array();
    private matchers_global: Array<Matcher> = Array();
    private active_matcher: Matcher;
    private events: Events = Object();
    private callback = this._callback.bind(this);
    private callback_global = this._callback_global.bind(this);
    private callback_prevent_default = this._prevent_default.bind(this);
    constructor(inst: HTMLElement, config?: ConfigWatcher) {
        let _config = Object.assign({}, Watcher.config_default);
        _config = Object.assign(_config, config);  // caution
        if (_config.share) {
            let watcher = Watcher.find_watcher(inst);
            if (watcher) {
                console.log("reuse watcher on", inst.nodeName);
                return watcher;
            }
            inst[MARK_WATCHER] = this;  // bind this to the dom object when set share
        }
        this.inst = inst;
        this.config = _config;
        this.init();
    }

    init() {
        // may cause bug
        // prevent the system handle the event, or may cause move event cancel unpredictable
        if (!Watcher.root_watcher) {
            window.addEventListener("pointermove", this.callback_prevent_default);
            Watcher.root_watcher = true;
        }
        // this used for prenvent pan action on mobile device
        // which may cause pointer event cancel
        this.inst.style.touchAction = "none";
        this.inst.addEventListener("pointerdown", this.callback);
    }

    destory() {
        this.matchers = undefined;
        for (const k in this.events) {
            if (this.events.hasOwnProperty(k)) {
                this.events[k] = undefined;
                delete this.events[k];
            }
        }
        this.inst.style.touchAction = "";  // remove the block
        this.inst.removeEventListener("pointerdown", this.callback);
    }

    private pre_process(data: PointerEvent): InputData {
        function get_init(result: InputData, event: PointerEvent) {
            result.path = <Array<Element>>event["path"];
            result.time = event.timeStamp;
            result.status = type2status[event.type];
            result.center.x = event.clientX;
            result.center.y = event.clientY;
            return result;
        }
        function get_duration(old: InputData, result: InputData) {
            result.duration = result.time - old.time;
            return result;
        }
        function get_delta(old: InputData, result: InputData) {
            result.delta = Vector2D.delta(old.center, result.center);
            return result;
        }
        function get_distence(old: InputData, result: InputData) {
            result.distence = Vector2D.distence(old.center, result.center);
            return result;
        }
        function get_theta(old: InputData, result: InputData) {
            result.theta = -Vector2D.theta(old.center, result.center);
            return result;
        }
        function get_direction(result: InputData, mode: "mutex" | "tolerant") {
            function direction_tolerant(result: InputData) {
                if (result.delta.x > 0) result.direction |= DIRECTION.RIGHT;
                if (result.delta.x < 0) result.direction |= DIRECTION.LEFT;
                if (result.delta.y > 0) result.direction |= DIRECTION.DOWN;
                if (result.delta.y < 0) result.direction |= DIRECTION.UP;
            }
            function direction_mutex(result: InputData) {
                if (Math.abs(result.delta.x) > Math.abs(result.delta.y)) {
                    if (result.delta.x > 0) result.direction |= DIRECTION.RIGHT;
                    if (result.delta.x < 0) result.direction |= DIRECTION.LEFT;
                }
                else {
                    if (result.delta.y > 0) result.direction |= DIRECTION.DOWN;
                    if (result.delta.y < 0) result.direction |= DIRECTION.UP;
                }
            }
            if (mode == "mutex") direction_mutex(result);
            if (mode == "tolerant") direction_tolerant(result);
        }
        let result = new InputData();
        get_init(result, data);
        if (data.type == "pointerdown") {
            this.start = result;
            return result;
        }
        // if (data.type == "pointerup" || data.type == "pointercancel") this.status = EVENT_STATUS.NONE;
        get_duration(this.start, result);
        get_delta(this.start, result);
        get_distence(this.start, result);
        get_theta(this.start, result);
        get_direction(result, this.config.direction);
        return result;
    }

    triger(raw_data: PointerEvent, self: boolean) {
        let data = this.pre_process(raw_data);
        // data.status & EVENT_STATUS.START && console.log("status before trigger", this.status, this.status_global);

        // global part
        if (this.status_global) {
            let status_global = PROCESS_STATUS.NONE;
            for (const matcher of this.matchers_global) {
                status_global |= matcher.match(this, this.events, data);
            }
            this.status_global = status_global;
            if (status_global & PROCESS_STATUS.END) this.reset_global();
        }

        // data.status & EVENT_STATUS.START && console.log("status after trigger", this.status_global);
        // block the handle if is global pointer down
        if (data.status & EVENT_STATUS.START && !self) return;

        // element part
        if (this.status) {
            let status: PROCESS_STATUS = PROCESS_STATUS.NONE;
            if (this.active_matcher) status = this.active_matcher.match(this, this.events, data);
            else {
                for (let matcher of this.matchers) {
                    // let _data = Object.assign({}, data);  // copy the input data make it seperate for each matcher
                    status |= matcher.match(this, this.events, data);
                    if (status & PROCESS_STATUS.ACTIVE) {
                        this.active_matcher = matcher;
                        break;
                    }
                    if (status & PROCESS_STATUS.HANDLED) {
                        break;
                    }
                }
            }
            if (status & PROCESS_STATUS.HANDLED) {
                if (this.config.block & WATCHER_BLOCK.ONCE) raw_data[MARK_HANDLED] = true;
            }
            if (status & (PROCESS_STATUS.END | PROCESS_STATUS.CANCEL)) {
                this.reset();
                return;
            }
            this.status = status;
        }
        // data.status & EVENT_STATUS.START && console.log("status after trigger", this.status);
    }

    find_matcher(global: boolean, str: string): Matcher {
        let matchers;
        if (global) matchers = this.matchers_global;
        else matchers = this.matchers;
        for (const matcher of matchers) {
            if (matcher.rule.event == str) return matcher;
        }
        return undefined;
    }

    add(matcher: Matcher) {
        let _matcher = this.find_matcher(matcher.global, matcher.rule.event);
        if (_matcher) {
            console.warn("Input.js trying add same event Matcher:", _matcher.rule.event);
            return;  // prevent add same event
        }
        if (matcher.global) this.matchers_global.push(matcher);
        else this.matchers.push(matcher);
    }

    rm(matcher: Matcher) {
        if (matcher.global) array_rm(this.matchers_global, matcher);
        else array_rm(this.matchers, matcher);
    }

    private split_events(events_string: string) {
        let result = events_string.split(" ");
        return result;
    }

    on(events_string: string, handler: (input_data: InputData) => void) {
        let events = this.split_events(events_string);
        for (const event of events) {
            if (!this.events[event]) this.events[event] = Array();
            this.events[event].push(handler);
        }
    }

    off(events_string: string, handler: Function) {
        let events = this.split_events(events_string);
        for (const event of events) {
            try {
                array_rm(this.events[event], handler);
            } catch (error) {
                console.error(error);
                console.warn("handler can't be removed from Watcher");
            }
        }
    }

    update_config(value: ConfigWatcher) {
        this.config = Object.assign(this.config, value);
    }

    reset() {
        // console.log("remove other callbacks");
        this._detach_callback();
        for (let matcher of this.matchers) {
            matcher.reset();
        }
        this.active_matcher = undefined;
        this.status = PROCESS_STATUS.NONE;
    }

    reset_global() {
        // console.log("remove global down");
        window.removeEventListener("pointerdown", this.callback_global);
        for (const matcher of this.matchers_global) {
            matcher.reset();
        }
        this.status_global = PROCESS_STATUS.NONE;
    }

    private _callback(event: PointerEvent) {
        if (event[MARK_HANDLED] == true) {
            this.status && this.reset();
            return;
        }
        if (!(this.config.block & WATCHER_BLOCK.SELF)) {
            if (event.type == "pointerdown") {
                // console.log(this.inst);
                if (!this.status) {
                    // console.log("bind other callbacks");
                    this._attach_callback();
                    this.status = PROCESS_STATUS.START;
                }
                if (this.matchers_global.length > 0 && !this.status_global) {
                    // console.log("bind global down");
                    window.addEventListener("pointerdown", this.callback_global);
                    this.status_global = PROCESS_STATUS.START;
                }
            }
            if (
                (this.status & (PROCESS_STATUS.ACTIVE | PROCESS_STATUS.WAIT)) ||
                (event.type == "pointerdown")
            ) this.triger(event, true);
        }
        if (this.config.block & WATCHER_BLOCK.OTHERS) event[MARK_HANDLED] = true;
    }
    private _callback_global(event: PointerEvent) {
        // console.log("global trigger");
        this.triger(event, false);
    }
    private _prevent_default(event: PointerEvent) {
        event.preventDefault();
    }
    private _attach_callback() {
        window.addEventListener("pointermove", this.callback);
        window.addEventListener("pointerup", this.callback);
        window.addEventListener("pointercancel", this.callback);
    }
    private _detach_callback() {
        window.removeEventListener("pointermove", this.callback);
        window.removeEventListener("pointerup", this.callback);
        window.removeEventListener("pointercancel", this.callback);
    }
}