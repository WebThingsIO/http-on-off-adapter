/**
 * http-on-off-adapter.js - OnOff adapter implemented as a plugin.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const fetch = require('node-fetch');

// Note that this is a patched version of mdns-js. It has PR #77 applied.
// The author of PR#77 put his change on master, so I forked mdns-js and
// created a pr-77 branch in my fork of the original so that we could
// create a dependency spec which works under both npm install and yarn.
const mdns = require('mdns-js');

let Adapter, Device, Property;
try {
  Adapter = require('../adapter');
  Device = require('../device');
  Property = require('../property');
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') {
    throw e;
  }

  const gwa = require('gateway-addon');
  Adapter = gwa.Adapter;
  Device = gwa.Device;
  Property = gwa.Property;
}

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

    // If the URL looks like http://wifi101-123456.local then extract
    // 123456 as the suffix to use for the device id and LED name.

    let urlPiece = url.split(/[-.]/);
    let suffix;
    if (urlPiece.length == 3) {
      suffix = '-' + urlPiece[1];
    } else {
      suffix = '';
    }

    super(adapter, id + suffix);

    this.url = url;
    this.name = 'LED' + suffix;
    this.type = 'onOffLight';
    this.description = 'Simple HTTP OnOff Light';

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

    let browser = mdns.createBrowser(mdns.tcp('http'));
    browser.on('ready', () => {
      console.log('Starting discovery...');
      browser.discover();
    });
    browser.on('update', (data) => {
      // The firmware from the http-on-off-wifi101 repository will wind up
      // creating a data record which looks like the following:
      //
      //  data: { addresses: [ '192.168.1.77' ],
      //  query: [],
      //  port: 80,
      //  fullname: 'http-on-off._moziot._tcp.local',
      //  txt: [ '_services' ],
      //  type:
      //   [ { name: 'dns-sd',
      //       protocol: 'udp',
      //       subtypes: [],
      //       description: undefined },
      //     { name: 'moziot',
      //       protocol: 'tcp',
      //       subtypes: [],
      //       description: undefined } ],
      //  host: 'wifi101-F714A9.local',
      //  interfaceIndex: 1,
      //  networkInterface: 'pseudo multicast' }

      if (data.hasOwnProperty('fullname') && data.hasOwnProperty('host')) {
        let fullname = data.fullname;
        let host = data.host;
        if (typeof fullname === 'string' && typeof host === 'string') {
          if (fullname.startsWith('http-on-off.') && host.startsWith('wifi101')) {
            let address = '';
            if (Array.isArray(data.addresses) && data.addresses.length > 0) {
              address = ' @ ' + data.addresses[0];
            }
            let url = 'http://' + host;
            console.log('Adding', url, '(via mDNS Discovery' + address + ')');
            this.handleDeviceAdded(
              new HttpOnOffDevice(this, 'HttpOnOffDevice', url));
          }
        }
      }
    });
  }
}

function loadHttpOnOffAdapter(addonManager, manifest, _errorCallback) {
  let adapter = new HttpOnOffAdapter(addonManager, manifest.name);
  let urls = manifest.moziot.config.url;
  if (!urls) {
    console.error('No URL specified in config');
    return;
  }
  if (!Array.isArray(urls)) {
    urls = [urls];
  }
  for (const url of urls) {
    console.log('Adding URL:', url, '(via config)');
    adapter.handleDeviceAdded(
      new HttpOnOffDevice(adapter, 'HttpOnOffDevice', url));
  }
}

module.exports = loadHttpOnOffAdapter;
