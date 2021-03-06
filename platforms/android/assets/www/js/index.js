/*globals bluetoothle,cordova,cordovaHTTP*/
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
    // Simulations
    // Because of time constraints, I am just hacking in simulation
    // stuff here for testing. This allows me to stay true to actual
    // deployment environment (as this is run on my android phone)
    // Not ideal but works for now...

    // Should send the correctly formatted message to receiver
    console.log('About to test detector!');
    detector.onDogDetected('beacon_id123', 10);
    console.log('Done!');

    // Should notify user of pet detected
    setTimeout(function() {
        console.log('Calling on PetDiscovered!');
        detector.ui.onPetDiscovered({name: 'Maui'}, {radius: 40});
    }, 2000);

};

var SCAN_DURATION = 5000,
    SCAN_INTERVAL = 60000;

var RECEIVER_URL = 'http://10.0.0.7:8080';  // FIXME

/* UIManager */
/**
 * A manager for displaying notifications and setting up the UI.
 *
 * @constructor
 * @return {undefined}
 */
var UIManager = function() {
    $.material.init();

    // Scanning elements
    this.scanning = false;
    this.scanBar = document.getElementById('scanBar');
    this.scanTitle = document.getElementById('scanTitle');

    // Pet found
    this.petContainer = document.getElementById('discoveredPets');
};

UIManager.prototype.onScanStart = function() {
    // Animate the progress bar
    this.scanning = true;
    var scanWidth = 0;

    this.scanTitle.innerHTML = 'Looking for Lost Pets';

    setTimeout(function animateScanBar() {
        if (this.scanning) {
            scanWidth = (scanWidth + 5)%100;
            this.scanBar.setAttribute('style', 'width: '+scanWidth+'%');
            setTimeout(animateScanBar.bind(this), 250);
        }
    }.bind(this), 100);
};

UIManager.prototype.onScanStop = function() {
    this.scanning = false;
    this.scanTitle.innerHTML = 'Look for Lost Pets';
    this.scanBar.setAttribute('style', 'width: 0%');
};

UIManager.prototype._createPetElement = function(pet, measurement) {
    var petCard = document.createElement('div'),
        header = document.createElement('h3'),
        content = document.createElement('h2');

    header.innerHTML = 'Found a lost pet!';
    content.innerHTML = pet.name+'<h4> ('+measurement.radius+' meters away)</h4>';  // TODO: Add more content (pic)
    petCard.setAttribute('class', 'jumbotron');

    petCard.appendChild(header);
    petCard.appendChild(content);
    return petCard;
};

UIManager.prototype.onPetDiscovered = function(pet, measurement) {
    // Prompt user with message
    // For now, create a new card and add it to the main screen
    var petCard = this._createPetElement(pet, measurement);
    this.petContainer.appendChild(petCard);
};

/* Dog Detector */

/**
 * The detector and reporter for pets.
 *
 * @constructor
 * @param {UIManager} ui
 * @return {undefined}
 */
var DogDetector = function(ui) {
    this.ui= ui;
    this.scanning = true;
    // Set it up to scan in the background
    var notification = {  // TODO: Set the image
        title: 'Homeward Bound is still active',
        text: 'Looking for lost pets!'
    };

    cordova.plugins.backgroundMode.setDefaults(notification);
    // Bluetooth
    bluetoothle.initialize(
        // on success
        function(status) {
            console.log('status:'+JSON.stringify(status));
            if (status.status === 'enabled') {
                console.log('Background mode enabled!');
                console.log('Bluetooth has been enabled!');
                this.startScanning();
            }
        }.bind(this),
        // on error
        function() {
            // Turn off background
            console.error('Could not start bluetooth LE');
            this.stopScanning();
        }, 
        // Params
        {
            request: true
        }
    );
};

DogDetector.prototype.startScanning = function() {
    this.ui.onScanStart();
    // Turn on background scanning
    cordova.plugins.backgroundMode.enable();
    this.scan();
};

DogDetector.prototype.stopScanning = function() {
    cordova.plugins.backgroundMode.disable();
    this.ui.onScanStop();
};

DogDetector.prototype.scan = function() {
    bluetoothle.startScan(
    // onStartSuccess
    function(result) {
        console.log('Scan result: '+JSON.stringify(result));
        if (result.status === 'scanStarted') {
            setTimeout(bluetoothle.stopScan.bind(bluetoothle,
                // Success
                function() {
                    console.log('Scan stopped.');
                    // Schedule next scan
                    if (this.scanning) {
                        setTimeout(this.scan.bind(this), SCAN_INTERVAL);
                    }
                }.bind(this),
                // Error
                function(e) {
                    console.log('Could not stop scan: '+JSON.stringify(e));
                }), 
            SCAN_DURATION);
        } else if (result.status === 'scanResult') {
            var dist = this.getDistance(result.rssi);
            this.onDogDetected(result.address, dist);
        }
    }.bind(this),
    // onStartError
    function(err) {
        console.error('Could not start scan: '+JSON.stringify(err));
    },
    // Filter params
    {});
    console.log('Scanning for nearby pets!');
};

DogDetector.prototype.toggleScanning = function() {
    this.scanning = !this.scanning;
    console.log('Scanning is set to '+this.scanning);
    if (this.scanning) {
        this.startScanning();
    } else {
        this.stopScanning();
    }
};

/**
 * Get distance from RSSI.
 *
 * @return {undefined}
 */
DogDetector.prototype.getDistance = function(rssi) {
    // TODO
    return Math.abs(rssi);
};

DogDetector.prototype.onDogDetected = function(uuid, distance) {
    // Get position
    console.log('Dog detected: '+uuid+' at '+distance);
    var report = this.reportMeasurement.bind(this, uuid, distance);
    navigator.geolocation.getCurrentPosition(report);
};

DogDetector.prototype.reportMeasurement = function(uuid, distance, pos) {
    var measurement = {
            uuid: uuid,
            radius: distance,
            timestamp: new Date().getTime(),
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
        };

    cordovaHTTP.post(RECEIVER_URL, measurement,
    {/*headers*/}, function(response) {
        // prints 200
        console.log('Success!');
        console.log(response.status);

        console.log('RESPONSE:'+JSON.stringify(response));
        if (response.status === 202) {  // Found a lost pet!
            try {
                // Retrieve the pet/owner info from the response
                // and notify the user
                console.log('RESPONSE:'+JSON.stringify(response));
                this.ui.onPetDiscovered(response, measurement);
            } catch(e) {
                console.error("JSON parsing error");
            }
        }
    }.bind(this), function(response) {
        console.log('Failure...');
        // prints 403
        console.log(response.status);

        //prints Permission denied 
        console.log(response.error);
    });
};

DogDetector.prototype.getUUID = function(major, minor) {
    return major+'\n'+minor;
};

// App Begins Here

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
        console.log('Starting device!');
        var ui = new UIManager();
        var detector = new DogDetector(ui);

        // Set up click events
        document.getElementById('scanCard').onclick = detector.toggleScanning.bind(detector);

        // Testing
        testDetector(detector);
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);

        console.log('Received Event: ' + id);
    }
};

console.log('Initializing app!');
app.initialize();
