/*globals cordovaHTTP*/
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
// For now, I will define my modules at the top... At least until I
// add either requireJS or something
'use strict';

var testDetector = function(detector) {
    // Simulate dog detected
    console.log('About to test detector!');
    detector.onDogDetected('beacon_id123', 10);
    console.log('Done!');
};

var RECEIVER_URL = 'http://10.0.0.7:8080';
var DogDetector = function() {
};

DogDetector.prototype.onDogDetected = function(uuid, distance) {
    // Get position
    var report = this.reportMeasurement.bind(this, uuid, distance);
    navigator.geolocation.getCurrentPosition(report);
};

DogDetector.prototype.reportMeasurement = function(uuid, distance, pos) {
    var req = new XMLHttpRequest(),
        measurement = {
            uuid: uuid,
            radius: distance,
            timestamp: new Date().getTime(),
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
        };

    cordovaHTTP.post(RECEIVER_URL, measurement,
    {/*headers*/}, function(response) {
        // prints 200
        console.log(response.status);
        try {
            response.data = JSON.parse(response.data);
            // prints test
            console.log(response.data.message);
        } catch(e) {
            console.error("JSON parsing error");
        }
    }, function(response) {
        // prints 403
        console.log(response.status);

        //prints Permission denied 
        console.log(response.error);
    });

    // TODO Queue the request in case there is no network connection!
    req.onload = function(e) {
        // Record if we should keep reporting the pet location
        // TODO

        // Notify the user of the nearby pet
        // TODO

        console.log('Response received: '+ req.responseText);
        //this.options[id] = JSON.parse(req.responseText);
    }.bind(this);

    // Check if it was get or post...
    console.log('Sending POST request to '+ RECEIVER_URL);
    req.open('post', RECEIVER_URL, true);
    //req.send(JSON.stringify(measurement));
};

DogDetector.prototype.getUUID = function(major, minor) {
    return major+'\n'+minor;
};

var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
        var detector = new DogDetector();
        testDetector(detector);
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};

app.initialize();