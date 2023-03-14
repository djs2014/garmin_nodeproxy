const garmin = require("./garmin");
const NodeCache = require('node-cache');

const alertCache = new NodeCache({ stdTTL: 1000 });

let fixedFloat = function (value) {
    try {
        return Number(parseFloat(value).toFixed(2));
    } catch (ex) {
        console.dir(ex);
        return 0.0;
    }
}

let getPropValue = function (item, name, def) {
    if (!item || !item.hasOwnProperty(name)) { return def; }
    return item[name];
}

let getOWMweather = function (item, def) {
    if (!item || !item.weather || item.length == 0) { return def; }
    return getPropValue(item.weather[0], "main", def).toLowerCase();
}

let getOWMweatherId = function (item, def) {
    if (!item || !item.weather || item.length == 0) { return def; }
    return getPropValue(item.weather[0], "id", def);
}

let getOWMweatherMinutely = function (minutely, maxMinutes, def) {
    if (!minutely || minutely.length == 0) { return def; }
    if (maxMinutes > 60) { maxMinutes = 60; }

    let total = 0;
    let dt_start = 0;
    let pops = [];
    for (let idx = 0; idx < maxMinutes; idx++) {
        let item = minutely[idx];
        //console.log(item);
        if (dt_start == 0) { dt_start = getPropValue(item, "dt", 0); }
        let pop = getPropValue(item, "precipitation", 0);
        pops.push(pop);
        total = total + pop;
    }
    if (total == 0) { pops = []; }
    return {
        dt_start: dt_start,
        pops: pops
    }
}

// @@ max 12 + start from current hour ..
let getOWMweatherHourly = function (hourly, maxHours, compact, def) {
    if (!hourly || hourly.length == 0) { return def; }
    if (!maxHours) { maxHours = 8; }

    let hours = [];
    for (let idx in hourly) {
        let item = hourly[idx];

        let h = {};
        h.dt = getPropValue(item, "dt", 0);
        h.clouds = getPropValue(item, "clouds", 0);
        h.pop = getPropValue(item, "pop", 0);
        h.cond = garmin.OWMtoGarminWeather(getOWMweather(item, 0), getOWMweatherId(item, ""));
        h.uvi = fixedFloat(getPropValue(item, "uvi", 0));
        h.w_s = fixedFloat(getPropValue(item, "wind_speed", 0));
        h.w_deg = getPropValue(item, "wind_deg", 0);
        // h.w_gust = fixedFloat(getPropValue(item, "wind_gust", 0));
        h.temp = fixedFloat(getPropValue(item, "temp", 0));
        h.press = getPropValue(item, "pressure", 0);
        h.humid = getPropValue(item, "humidity", 0);
        h.dew_p = fixedFloat(getPropValue(item, "dew_point", 0));

        if (compact) {
            hours.push([h.dt, h.clouds, h.pop, h.cond, h.uvi, h.w_s, h.w_deg, h.temp, h.press, h.humid, h.dew_p]);
        } else {
            hours.push(h);
        }

        if (idx >= (maxHours - 1)) { break; }
    }
    return hours;
}

let getOWMWeatherCurrent = function (parsed, compact) {
    var c = {
        "lat": getPropValue(parsed, "lat", 0),
        "lon": getPropValue(parsed, "lon", 0),
        "tz_offset": getPropValue(parsed, "timezone_offset", 0),
        //
        "dt": getPropValue(parsed.current, "dt", 0),
        "clouds": getPropValue(parsed.current, "clouds", 0),
        "pop" : 0, // @@TODO from daily
        "cond": garmin.OWMtoGarminWeather(getOWMweather(parsed.current, 0), getOWMweatherId(parsed.current, "")),
        "uvi": fixedFloat(getPropValue(parsed.current, "uvi", 0)),
        "w_s": fixedFloat(getPropValue(parsed.current, "wind_speed", 0)),
        "w_deg": getPropValue(parsed.current, "wind_deg", 0),
        // "w_gust" : fixedFloat(getPropValue(parsed.current, "wind_gust", 0)),
        "temp": fixedFloat(getPropValue(parsed.current, "temp", 0)),
        "press": getPropValue(parsed.current, "pressure", 0),
        "humid": getPropValue(parsed.current, "humidity", 0),
        "dew_p": fixedFloat(getPropValue(parsed.current, "dew_point", 0)),
    }
    if (compact) {
        return {
            "lat": c.lat,
            "lon": c.lon,
            "dt" : c.dt,
            "tz_offset": c.tz_offset,    
            "data": [c.dt, c.clouds, c.pop, c.cond, c.uvi, c.w_s, c.w_deg, c.temp, c.press, c.humid, c.dew_p]
        }
    }
    return c;
}

// return 1 alert per request
let getOWMAlerts = function (key, owmAlerts, def) {
    if (!owmAlerts || owmAlerts.length == 0) { return def; }

    // let cachedAlerts = [];
    // let updateCache = false;
    // if (key) {
    //     cachedAlerts = alertCache.get(key);
    //     if (!cachedAlerts) { cachedAlerts = []; }
    // }

    let alerts = [];
    for (let idx in owmAlerts) {
        let item = owmAlerts[idx];
        let alert = {};
        alert.evt = getPropValue(item, "event", "");
        alert.dts = getPropValue(item, "start", 0);
        alert.dte = getPropValue(item, "end", 0);
        alert.desc = getPropValue(item, "description", "");
        
        alerts.push([alert.evt, alert.dts, alert.dte, alert.desc])       
        
       
        // let alertDetailed = {};
        // alertDetailed.evt = getPropValue(item, "event", "");
        // alertDetailed.dts = getPropValue(item, "start", 0);
        // alertDetailed.dte = getPropValue(item, "end", 0);
        // alertDetailed.desc = getPropValue(item, "description", "");
        // alertDetailed.tags = getPropValue(item, "tags", []);
        // if (!isCachedAlert(cachedAlerts, alertDetailed)) {
        //     cachedAlerts.push(alertDetailed);
        //     updateCache = true;
        // }

    }
    // if (updateCache) {
    //     alertCache.set(key, cachedAlerts, 1000)
    // }
    return alerts;
}

let isCachedAlert = function (cachedAlerts, alert) {
    for (let idx in cachedAlerts) {
        let cached = cachedAlerts[idx];
        if (cached.evt == alert.evt && cached.dts == alert.dts && cached.dte == alert.dte) {
            return true;
        }
    }
    return false;
}

// https://en.wikipedia.org/wiki/Decimal_degrees
let getCacheKey = function (appid, lat, lon) {
    try {
        let nlat = parseFloat(lat);
        let nlon = parseFloat(lon);
        // cached for ~100km2 region
        return "alert[" + appid + "-" + nlat.toFixed(0) + "-" + nlon.toFixed(0) + "]";;
    } catch (e) {
        return null;
    }
}

let parseOWMdata = function (appid, lat, lon, data, maxHours, maxMinutes, compact, getAlerts) {
    let mod = {};
    try {
        let jsonParsed = JSON.parse(data);

        mod.current = getOWMWeatherCurrent(jsonParsed, compact);
        // minutely, only available for payed subscription to OWM 
        if (maxMinutes > 0) {
            mod.minutely = getOWMweatherMinutely(jsonParsed.minutely, maxMinutes, {});
        }
        // hourly
        mod.hourly = getOWMweatherHourly(jsonParsed.hourly, maxHours, compact, []);

        if (getAlerts) {
            // alerts
            let key = getCacheKey(appid, lat, lon);
            mod.alerts = getOWMAlerts(key, jsonParsed.alerts, []);
        }
        let size = getBinarySize(JSON.stringify(mod));
        console.log(size);        
    } catch (ex) {
        console.log(ex);
    }
    return mod;
}

let getBinarySize = function(string) {
    return Buffer.byteLength(string, 'utf8');
}

exports.convertOWMdata = function (appid, lat, lon, data, maxHours, maxMinutes, compact, getAlerts) {
    return parseOWMdata(appid, lat, lon, data, maxHours, maxMinutes, compact, getAlerts);
}

exports.convertTestdata = function (appid, lat, lon, data, maxHours, maxMinutes, compact, getAlerts) {
    let mod = parseOWMdata(appid, lat, lon, data, maxHours, maxMinutes, compact, getAlerts);
    try {
        // adjust dates
        mod.current.dt = Math.floor(Date.now() / 1000);
        if (compact) {
            mod.current.data[0] = mod.current.dt;
        }
        // hourly starts in current hour    
        let today = new Date(Date.now());
        let year = today.getFullYear();
        let month = today.getMonth();
        let day = today.getDate(); // day of the month
        let hours = today.getHours();
        for (let idx in mod.hourly) {
            if (compact) {
                mod.hourly[idx][0] = Math.floor(new Date(year, month, day, hours, 0, 0) / 1000);
            } else {
                mod.hourly[idx].dt = Math.floor(new Date(year, month, day, hours, 0, 0) / 1000);
            }
            hours = hours + 1;
            if (hours > 23) {
                hours = 0;
                day = day + 1;
            }
        }
    } catch (ex) {
        console.log(ex);
    }
    return mod;
}

exports.convertOWMError = function (status, body) {
    let converted = {};
    converted.status = status;
    try {
        let parsed = JSON.parse(body);
        converted.owmstatus = parsed.status;       
        converted.error = parsed.message;       
        if (converted.error) {
            converted.error = converted.error.substring(0, 100);
        }
    } catch (ex) {
        console.log(ex);
    }
    return converted;
}

exports.getCachedAlerts = function (appid, lat, lon) {
    let key = getCacheKey(appid, lat, lon);
    let alerts = null;
    if (key) { alerts = alertCache.get(key); }
    if (!alerts || alerts.length == 0) { return []; }
    return alerts;
}