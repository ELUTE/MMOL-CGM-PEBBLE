// global variable for last alert time
var lastAlert = 0;

// main function to retrieve, format, and send cgm data
function fetchCgmData(lastReadTime, lastBG) {
    
    // declare local constants for time differences
    var TIME_5_MINS = 5 * 60 * 1000,
    TIME_10_MINS = 10 * 60 * 1000,
    TIME_15_MINS = 15 * 60 * 1000,
    TIME_30_MINS = TIME_15_MINS * 2;

    // declare local constants for arrow trends
    var NO_ARROW = 0, 
    DOUBLE_UP = 1,
    SINGLE_UP = 2,
    FORTYFIVE_UP = 3,
    FLAT_ARROW = 4,
    FORTYFIVE_DOWN = 5,
    SINGLE_DOWN = 6,
    DOUBLE_DOWN = 7,
    NOT_COMPUTABLE = 8,
    RATE_OUT_OF_RANGE = 9,
    LOGO = 10;

    // hard code name of T1D person, for now
    var NameofT1DPerson = "";

    // declare local variables for message data
    var response, message;

    //call options & started to get endpoint & start time
    var opts = options( );
    var started = new Date( ).getTime( );

    //if endpoint is invalid, return error msg to watch
    if (!opts.endpoint) {
        message = {
        icon: [0,LOGO],
        bg: '---',
        readtime: timeago(new Date().getTime() - started),
        alert: 0,
        time: formatDate(new Date()),
        delta: 'CHECK ENDPOINT',
        battlevel: "",
        t1dname: ""
        };
        
        console.log("sending message", JSON.stringify(message));
        MessageQueue.sendAppMessage(message);
        return;
    }

    // call XML
    var req = new XMLHttpRequest();
    //console.log('endpoint: ' + opts.endpoint);
    
    // get cgm data
    req.open('GET', opts.endpoint, true);
    
    req.onload = function(e) {

        if (req.readyState == 4) {

            if(req.status == 200) {
                
                // Load response   
                response = JSON.parse(req.responseText);
                response = response.bgs;
                
                // check response data
                if (response && response.length > 0) {

                    // response data is good; send log with response 
                    console.log('got response', JSON.stringify(response));
                    
                    // see if we're in a Rajat build
                    var RajatBuild = isRajatBuild(opts.endpoint, "heroku");
                    if (RajatBuild) {
                      // set Rajat arrow constants
                      DOUBLE_UP = 0;
                      SINGLE_UP = 1;
                      FORTYFIVE_UP = 2;
                      FLAT_ARROW = 3;
                      NO_ARROW = 4;
                    }

                    // initialize message data
                    var now = new Date().getTime(),
                    sinceLastAlert = now - lastAlert,
                    alertValue = 0,
                    currentBG = response[0].sgv,
                    currentBGDelta = response[0].bgdelta,
                    currentTrend = response[0].trend,
                    delta = (currentBGDelta > 0 ? '+' : '') + currentBGDelta + " mmol",
                    readingtime = new Date(response[0].datetime).getTime(),
                    readago = now - readingtime,

                    // battery not included in response yet, so have to send no battery for now
                    // once battery is included, uncomment out line and erase "111" line
                    //currentBattery = response[0].battery;
                    currentBattery = "111";
                    
                    // see if we're in a Rajat build
                    var RajatBuild = isRajatBuild(opts.endpoint, "heroku");
                    if (RajatBuild) {
                      // set Rajat arrow constants
                      DOUBLE_UP = 0;
                      SINGLE_UP = 1;
                      FORTYFIVE_UP = 2;
                      FLAT_ARROW = 3;
                      NO_ARROW = 4;
                      delta = (currentBGDelta > 0 ? '+' : '') + (currentBGDelta/ 18.01559).toFixed(1) + " mmol";
                      // can't read battery so set to 111 to indicate Rajat build
                      currentBattery = "111";
                    }
                                                          
                    // debug logs; uncomment when need to debug something
                    //console.log("now: " + now);
                    //console.log("sinceLastAlert: " + sinceLastAlert);
                    //console.log("current BG: " + currentBG);
                    //console.log("current BG delta: " + currentBGDelta);
                    //console.log("arrow: " + currentTrend);
                    //console.log('RajatBuild?: ' + RajatBuild);
                    //console.log("readingtime: " + readingtime);
                    //console.log("readago: " + readago);
                    //console.log("current Battery: " + currentBattery);
                    
                    // set vibration pattern; alert value; 0 nothing, 1 normal, 2 low, 3 high
                    
                    if (currentBG < 2) {
                        if (sinceLastAlert > TIME_10_MINS) alertValue = 2;
                    } else if (currentBG < 3)
                        alertValue = 2;
                    else if (currentBG < 3.5 && currentBGDelta < 0)
                        alertValue = 2;
                    else if (currentBG < 4 && sinceLastAlert > TIME_15_MINS)
                        alertValue = 2;
                    else if (currentBG < 6.5 && currentTrend == DOUBLE_DOWN && sinceLastAlert > TIME_5_MINS)
                        alertValue = 2;
                    else if (currentBG == 5.5 && currentTrend == FLAT_ARROW && sinceLastAlert > TIME_15_MINS) //Perfect Score - a good time to take a picture :)
                        alertValue = 1;
                    else if (currentBG > 6.5 && currentTrend == DOUBLE_UP && sinceLastAlert > TIME_15_MINS)
                        alertValue = 3;
                    else if (currentBG > 10 && sinceLastAlert > TIME_30_MINS && currentBGDelta > 0)
                        alertValue = 3;
                    else if (currentBG > 14 && sinceLastAlert > TIME_30_MINS)
                        alertValue = 3;
                    else if (currentBG > 17 && sinceLastAlert > TIME_15_MINS)
                        alertValue = 3;
                    
                    if (alertValue === 0 && readago > TIME_10_MINS && sinceLastAlert > TIME_15_MINS) {
                        alertValue = 1;
                    }
                    
                    if (alertValue > 0) {
                        lastAlert = now;
                    }
                    
                    // load message data  
                    message = {
                    icon: [RajatBuild,currentTrend],
                    bg: currentBG,
                    readtime: timeago(new Date().getTime() - (new Date(response[0].datetime).getTime())),
                    alert: alertValue,
                    time: formatDate(new Date()),
                    delta: delta,
                    battlevel: currentBattery,
                    t1dname: NameofT1DPerson
                    };
                    
                    // send message data to log and to watch
                    console.log("message: " + JSON.stringify(message));
                    MessageQueue.sendAppMessage(message);

                // response data is no good; format error message and send to watch                      
                } else {
                    message = {
                    icon: [0,LOGO],
                    bg: '---',
                    readtime: timeago(new Date().getTime() - (now)),
                    alert: 1,
                    time: formatDate(new Date()),
                    delta: 'DATA OFFLINE',
                    battlevel: "",
                    t1dname: ""
                    };
                    console.log("sending message", JSON.stringify(message));
                    MessageQueue.sendAppMessage(message);
                }
            }
        }
    };
    req.send(null);
}

// format date hours:minutes; add AM + PM if want
function formatDate(date) {
    var minutes = date.getMinutes(),
    hours = date.getHours() || 12,
    meridiem = " PM",
    formatted;
    
    if (hours > 12)
        hours = hours - 12;
    else if (hours < 12)
        meridiem = " AM";
 
    // don't want AM & PM, so add line with blank
    // if want to add later, then comment out this line  
    meridiem = "";

    if (minutes < 10)
        formatted = hours + ":0" + date.getMinutes() + meridiem;
    else
        formatted = hours + ":" + date.getMinutes() + meridiem;

    return formatted;
}

// format past time difference data
function timeago(offset) {
    var parts = {},
    MINUTE = 60 * 1000,
    HOUR = 3600 * 1000,
    DAY = 86400 * 1000,
    WEEK = 604800 * 1000;
    
    if (offset <= MINUTE)              parts = { lablel: 'now' };
    if (offset <= MINUTE * 2)          parts = { label: '1 min ago' };
    else if (offset < (MINUTE * 60))   parts = { value: Math.round(Math.abs(offset / MINUTE)), label: 'min' };
    else if (offset < (HOUR * 2))      parts = { label: '1 hr ago' };
    else if (offset < (HOUR * 24))     parts = { value: Math.round(Math.abs(offset / HOUR)), label: 'hrs' };
    else if (offset < (DAY * 1))       parts = { label: '1 dy ago' };
    else if (offset < (DAY * 7))       parts = { value: Math.round(Math.abs(offset / DAY)), label: 'dys' };
    else if (offset < (WEEK * 52))     parts = { value: Math.round(Math.abs(offset / WEEK)), label: 'wks' };
    else                               parts = { label: 'BEFORE DX'};
    
    if (parts.value)
        return parts.value + ' ' + parts.label + ' ago';
    else
        return parts.label;
    
}

// get endpoint for XML request
function options ( ) {
    var opts = [ ].slice.call(arguments).pop( );
    if (opts) {
        window.localStorage.setItem('cgmPebble', JSON.stringify(opts));
    } else {
        opts = JSON.parse(window.localStorage.getItem('cgmPebble'));
    }
    return opts;
}

// check for Rajat build
function isRajatBuild (str, str_to_match) {
   return (str.indexOf(str_to_match) >= 0);
}

// message queue-ing to pace calls from C function on watch
var MessageQueue = (function () {
                    
                    var RETRY_MAX = 5;
                    
                    var queue = [];
                    var sending = false;
                    var timer = null;
                    
                    return {
                    reset: reset,
                    sendAppMessage: sendAppMessage,
                    size: size
                    };
                    
                    function reset() {
                    queue = [];
                    sending = false;
                    }
                    
                    function sendAppMessage(message, ack, nack) {
                    
                    if (! isValidMessage(message)) {
                    return false;
                    }
                    
                    queue.push({
                               message: message,
                               ack: ack || null,
                               nack: nack || null,
                               attempts: 0
                               });
                    
                    setTimeout(function () {
                               sendNextMessage();
                               }, 1);
                    
                    return true;
                    }
                    
                    function size() {
                    return queue.length;
                    }
                    
                    function isValidMessage(message) {
                    // A message must be an object.
                    if (message !== Object(message)) {
                    return false;
                    }
                    var keys = Object.keys(message);
                    // A message must have at least one key.
                    if (! keys.length) {
                    return false;
                    }
                    for (var k = 0; k < keys.length; k += 1) {
                    var validKey = /^[0-9a-zA-Z-_]*$/.test(keys[k]);
                    if (! validKey) {
                    return false;
                    }
                    var value = message[keys[k]];
                    if (! validValue(value)) {
                    return false;
                    }
                    }
                    
                    return true;
                    
                    function validValue(value) {
                    switch (typeof(value)) {
                    case 'string':
                    return true;
                    case 'number':
                    return true;
                    case 'object':
                    if (toString.call(value) == '[object Array]') {
                    return true;
                    }
                    }
                    return false;
                    }
                    }
                    
                    function sendNextMessage() {
                    
                    if (sending) { return; }
                    var message = queue.shift();
                    if (! message) { return; }
                    
                    message.attempts += 1;
                    sending = true;
                    Pebble.sendAppMessage(message.message, ack, nack);
                    
                    timer = setTimeout(function () {
                                       timeout();
                                       }, 1000);
                    
                    function ack() {
                    clearTimeout(timer);
                    setTimeout(function () {
                               sending = false;
                               sendNextMessage();
                               }, 200);
                    if (message.ack) {
                    message.ack.apply(null, arguments);
                    }
                    }
                    
                    function nack() {
                    clearTimeout(timer);
                    if (message.attempts < RETRY_MAX) {
                    queue.unshift(message);
                    setTimeout(function () {
                               sending = false;
                               sendNextMessage();
                               }, 200 * message.attempts);
                    }
                    else {
                    if (message.nack) {
                    message.nack.apply(null, arguments);
                    }
                    }
                    }
                    
                    function timeout() {
                    setTimeout(function () {
                               sending = false;
                               sendNextMessage();
                               }, 1000);
                    if (message.ack) {
                    message.ack.apply(null, arguments);
                    }
                    }
                    
                    }
                    
                    }());

// pebble specific calls with watch
Pebble.addEventListener("ready",
                        function(e) {
                        console.log("connect: " + e.ready);
                        //fetchCgmData(0, 0);
                        });

Pebble.addEventListener("appmessage",
                        function(e) {
                        console.log("Received message: " + JSON.stringify(e.payload));
                        fetchCgmData(e.payload.readtime, e.payload.bg);
                        });

Pebble.addEventListener("showConfiguration", function(e) {
                        console.log("showing configuration", JSON.stringify(e));
                        Pebble.openURL('http://bewest.github.io/cgm-pebble/configurable.html');
                        });

Pebble.addEventListener("webviewclosed", function(e) {
                        var opts = e.response.length > 5
                        ? JSON.parse(decodeURIComponent(e.response)): null;
                        
                        options(opts);
                        
                        });



