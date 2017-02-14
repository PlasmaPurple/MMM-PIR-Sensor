'use strict';

/* Magic Mirror
 * Module: MMM-PIR-Sensor
 *
 * By Paul-Vincent Roll http://paulvincentroll.com
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
const Gpio = require('onoff').Gpio;
const exec = require('child_process').exec;

var offDelayTime; //time to delay turning off the hdmi, set from config
var offDelay;  //object holding delay timeout

module.exports = NodeHelper.create({
  start: function () {
    this.started = false;
  },

  activateMonitor: function () {
    if (this.config.relayPIN != false) {
      this.relay.writeSync(this.config.relayOnState);
    }
    else if (this.config.relayPIN == false){
      exec("/opt/vc/bin/tvservice --preferred && sudo chvt 6 && sudo chvt 7", null);
      clearTimeout(offDelay); //if motion is detected, stop the screen off timeout
    }
  },

  deactivateMonitor: function () {
    if (this.config.relayPIN != false) {
      this.relay.writeSync(this.config.relayOffState);
    }
    else if (this.config.relayPIN == false){
      //HDMI off in a timeout, default to 0 so display off happen asap
      offDelay = setTimeout(function () {
        exec("/opt/vc/bin/tvservice -o", null);
      }, offDelayTime*1000);
    }
  },

  // Subclass socketNotificationReceived received.
  socketNotificationReceived: function(notification, payload) {
    if (notification === 'CONFIG' && this.started == false) {
      const self = this;
      this.config = payload;

      //Setup pins
      this.pir = new Gpio(this.config.sensorPIN, 'in', 'both');
      // exec("echo '" + this.config.sensorPIN.toString() + "' > /sys/class/gpio/export", null);
      // exec("echo 'in' > /sys/class/gpio/gpio" + this.config.sensorPIN.toString() + "/direction", null);

      //Setup display off delay
      offDelayTime = this.config.offDelayTime;
      
      if (this.config.relayPIN) {
        this.relay = new Gpio(this.config.relayPIN, 'out');
        this.relay.writeSync(this.config.relayOnState);
        exec("/opt/vc/bin/tvservice --preferred && sudo chvt 6 && sudo chvt 7", null);
      }

      //Detected movement
      this.pir.watch(function(err, value) {
        if (value == 1) {
          self.sendSocketNotification("USER_PRESENCE", true);
          if (self.config.powerSaving){
            self.activateMonitor();
          }
         }
        else if (value == 0) {
          self.sendSocketNotification("USER_PRESENCE", false);
          if (self.config.powerSaving){
            self.deactivateMonitor();
          }
        }
      });

      this.started = true;

    } else if (notification === 'SCREEN_WAKEUP') {
      this.activateMonitor();
    }
  }

});
