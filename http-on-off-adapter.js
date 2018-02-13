/**
 * http-on-off-adapter.js - OnOff adapter implemented as a plugin.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const Adapter = require('../adapter');
const Device = require('../device');
const Property = require('../property');
const fetch = require('node-fetch');

class HttpOnOffProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;

    // In an ideal world, we would query the device and return
    // it's value.
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
  }

  /**
   * @method setValue
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    return new Promise((resolve, reject) => {
      let url;
      if (value) {
        url = this.device.url + '/H';
      } else {
        url = this.device.url + '/L';
      }
      fetch(url).then(() => {
        this.setCachedValue(value);
        console.log('Property:', this.name, 'set to:', this.value);
        resolve(value);
        this.device.notifyPropertyChanged(this);
      }).catch(e => {
        console.error('Request to:', url, 'failed');
        console.error(e);
        reject(e);
      });
    });
  }
}

class HttpOnOffDevice extends Device {
  constructor(adapter, id, url) {
    super(adapter, id);

    this.url = url;
    this.name = 'LED';
    this.type = 'onOffLight';
    this.description = 'Simple HTTP OnOff Light';

    console.log('Device URL:', url, 'added');

    this.properties.set('on', new HttpOnOffProperty(this, 'on', {
      type: 'boolean',
      value: false,
    }));
  }
}

class HttpOnOffAdapter extends Adapter {
  constructor(addonManager, packageName) {
    super(addonManager, 'HttpOnOffAdapter', packageName);
    addonManager.addAdapter(this);
  }
}

function loadHttpOnOffAdapter(addonManager, manifest, _errorCallback) {
  let adapter = new HttpOnOffAdapter(addonManager, manifest.name);
  let url = manifest.moziot.config.url;
  if (!url) {
    console.error('No URL specified in config');
    return;
  }

  adapter.handleDeviceAdded(new HttpOnOffDevice(adapter,
                                                'HttpOnOffDevice-01',
                                                url));
}

module.exports = loadHttpOnOffAdapter;
