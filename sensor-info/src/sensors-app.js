import {LitElement, html, css} from 'lit-element';
import "@material/mwc-icon/mwc-icon.js";
import "@material/mwc-button/mwc-button.js";
import '@polymer/app-layout/app-header/app-header.js';
import '@polymer/app-layout/app-header-layout/app-header-layout.js';
import '@polymer/app-layout/app-toolbar/app-toolbar.js';
import '@polymer/app-layout/app-scroll-effects/effects/waterfall.js';
import '@polymer/paper-dialog/paper-dialog.js';
import '@polymer/paper-dropdown-menu/paper-dropdown-menu-light.js';
import '@polymer/paper-listbox/paper-listbox.js';
import '@polymer/paper-item/paper-item.js';
import '@polymer/paper-input/paper-input.js';
import '@polymer/paper-toast/paper-toast.js';
import '@polymer/paper-toggle-button/paper-toggle-button.js';

class SensorsApp extends LitElement {
  constructor() {
    super();
    this.sensorDataModel = [];
    this.sensorDataCSV = "";
    this.isStartRecord = false;
    this.isSuspendRecord = false;
    this.isStopRecord = false;
    this.recordNum = 0;
    this.csvList = [];
    this.csvNameList = [];
    this.downloadNum = 0;
    this.startTimestamp = "";
  }

  openAddSensorDialog() {
    this.addSensorDialog = this.shadowRoot.querySelector('#addSensorDialog');
    this.addSensorDialog.open();
  }

  addSensor() {
    this.selectedSensor = this.shadowRoot.querySelector('#selectedSensor');
    this.selectedFrequency = this.shadowRoot.querySelector('#selectedFrequency');
    this.toastPleaseSelectSensor = this.shadowRoot.querySelector('#toastPleaseSelectSensor');
    this.toastNotSupported = this.shadowRoot.querySelector('#toastNotSupported');
    this.recordDivElement = this.shadowRoot.querySelector('#recordDiv');
    this.recordDivElement.className = "toggle item block";
    let options = null;
    let sensorConstructor = null;

    if (!this.selectedSensor.value) {
      this.toastPleaseSelectSensor.open();
      return;
    }

    if (this.selectedFrequency.value !== "" && !isNaN(this.selectedFrequency.value)) {
      options = {
        frequency: this.selectedFrequency.value
      };
    }

    switch (this.selectedSensor.value) {
    case "Ambient light":
      sensorConstructor = window.AmbientLightSensor;
      break;

    case "Accelerometer":
      sensorConstructor = window.Accelerometer;
      break;

    case "LinearAcceleration":
      sensorConstructor = window.LinearAccelerationSensor;
      break;

    case "Gyroscope":
      sensorConstructor = window.Gyroscope;
      break;

    case "Magnetometer":
      sensorConstructor = window.Magnetometer;
      break;

    case "AbsoluteOrientation":
      sensorConstructor = window.AbsoluteOrientationSensor;
      break;

    case "RelativeOrientation":
      sensorConstructor = window.RelativeOrientationSensor;
      break;
    }

    if (!sensorConstructor) {
      this.toastNotSupported.open();
      return;
    }

    let sensor = new sensorConstructor(options || {});

    sensor.name = this.selectedSensor.value;
    sensor.frequency = (options && options.hasOwnProperty('frequency')) ? `${options.frequency} Hz` : 'default';
    sensor.id = this.sensorDataModel.length;

    sensor.onreading = () => {
      function round(number, precision) {
        let factor = 10 ** precision;
        return Math.round(number * factor) / factor;
      }

      let i = 0;
      let properties = new Array("timestamp", "illuminance", "x", "y", "z", "quaternion");

      for (let property in properties) {
        let propertyName = properties[property];
        if (propertyName == 'timestamp') {
          sensor.readingTimestamp = `timestamp: ${round(sensor.timestamp, 3)}`;
        } else if (propertyName in sensor) {
          if (propertyName == 'quaternion') {
            sensor.readingValue0 = `${propertyName}.X: ${round(sensor[propertyName][0], 3)}`;
            sensor.readingValue1 = `${propertyName}.Y: ${round(sensor[propertyName][1], 3)}`;
            sensor.readingValue2 = `${propertyName}.Z: ${round(sensor[propertyName][2], 3)}`;
            sensor.readingValue3 = `${propertyName}.W: ${round(sensor[propertyName][3], 3)}`;
          } else {
            let readingId = `readingValue${i++}`;
            sensor[readingId] = `${propertyName}: ${round(sensor[propertyName], 3)}`;
          }
        }
      }

      // Add records for download csv
      if (this.isStartRecord && !this.isSuspendRecord && !this.isStopRecord) {
        let record = `${sensorConstructor.name},`;
        record += `${sensor.frequency == "default" ? 60 : options.frequency},`;
        record += `${sensor.timestamp},`;
        if (sensor.name == "Ambient light") {
          record += `${sensor.illuminance}\n`;
        } else if (sensor.name == "AbsoluteOrientation" || sensor.name == "RelativeOrientation") {
          record += `,,,,${sensor.quaternion[0]},${sensor.quaternion[1]},${sensor.quaternion[2]},${sensor.quaternion[3]}\n`;
        } else {
          record += `,${sensor.x},${sensor.y},${sensor.z}\n`;
        }
        this.sensorDataCSV += record;
        this.recordNum++;
        this.requestUpdate('recordNum');
        this.requestUpdate('sensorDataCSV');
      }

      this.requestUpdate('sensorDataModel');
    }

    sensor.onerror = e => {
      sensor.errorType = `Error: ${e.error.name}`;
      sensor.errorMessage = `Error message: ${e.error.message}`;
      this.requestUpdate('sensorDataModel');
    }

    sensor.onactivate = () => {
      this.requestUpdate('sensorDataModel');
    };

    this.sensorDataModel.push(sensor);
    this.requestUpdate("sensorDataModel");
  }

  removeSensor(event) {
    let id = event.currentTarget.id;
    let index = this.sensorDataModel.findIndex(v => v.id == id);

    if (index == -1) {
      return;
    }

    // Stop sensor
    this.sensorDataModel[id].stop();

    this.sensorDataModel.splice(index, 1);
    // Update ids
    for (let i = 0; i < this.sensorDataModel.length; ++i) {
      this.sensorDataModel[i].id = i;
    }
    this.requestUpdate("sensorDataModel");
    // Update toggle buttons
    for (let i = 0; i < this.sensorDataModel.length; ++i) {
      this.shadowRoot.querySelector(`#toggle_${i}`).checked = this.sensorDataModel[i].active;
    }
  }

  sensorToggleChanged(event) {
    let toggle_id = event.currentTarget.id;
    let id = toggle_id.substring(7);
    if (event.target.checked) {
      this.sensorDataModel[id].start();
      this.sensorDataModel[id].active = true;
    } else {
      this.sensorDataModel[id].stop();
      this.sensorDataModel[id].active = false;
    }

    this.requestUpdate('sensorDataModel');
  }

  startRecord() {
    this.isStartRecord = true;
    this.isSuspendRecord = false;
    this.isStopRecord = false;
    this.recordNum = 0;
    this.downloadNum = 0;

    let suspendElement = this.shadowRoot.querySelector('#suspendRecord');
    suspendElement.className = "blue";
    suspendElement.label = "Suspend";
    let stopElement = this.shadowRoot.querySelector('#stopRecord');
    stopElement.className = "blue";
    let downloadElement = this.shadowRoot.querySelector('#downloadRecord');
    downloadElement.className = "blue";

    this.sensorDataCSV = "data:text/csv;charset=utf-8,"
                       + "SensorType,frequency,timestamp,illuminance,x,y,z,"
                       + "quaternion.x,quaternion.y,quaternion.z,quaternion.w\n";
    this.startTimestamp = Math.floor(Date.now() / 1000);
    let csvName = this.shadowRoot.querySelector('#csvName');
    csvName.value = `sensor_${this.startTimestamp}.csv`;
  }

  suspendRecord() {
    let suspendElement = this.shadowRoot.querySelector('#suspendRecord');
    if (suspendElement.className == "gray") return;

    if (suspendElement.label == "Suspend") {
      suspendElement.label = "Resume";
      this.isSuspendRecord = true;
    } else {
      suspendElement.label = "Suspend";
      this.isSuspendRecord = false;
    }
  }

  stopRecord() {
    let stopElement = this.shadowRoot.querySelector('#stopRecord');
    if (stopElement.className == "gray") return;
    stopElement.className = "gray";

    let suspendElement = this.shadowRoot.querySelector('#suspendRecord');
    suspendElement.label = "Suspend";
    suspendElement.className = "gray";

    this.isStartRecord = false;
    this.isSuspendRecord = false;
    this.isStopRecord = true;
  }

  downloadRecord() {
    let downloadElement = this.shadowRoot.querySelector('#downloadRecord');
    if (downloadElement.className == "gray") return;

    let csvName = this.shadowRoot.querySelector('#csvName');
    let name = csvName.value;

    if (this.csvNameList.includes(name)) {
      alert("The csv name is exist, please change a new one.");
      return;
    }
    if (!name.endsWith(".csv")) {
      name += ".csv";
    }
    this.csvList.push([name, this.recordNum]);
    this.csvNameList.push(name);

    let encodedUri = encodeURI(this.sensorDataCSV);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", name);
    link.click();
    this.requestUpdate('csvList');

    this.downloadNum++;
    csvName.value = `sensor_${this.startTimestamp}_${this.downloadNum}.csv`;
  }

  static get styles() {
    return css`
        :host {
          --app-primary-color: #0071c5;
          --app-secondary-color: black;
          display: block;
        }

        app-header {
          color: #fff;
          background-color: var(--app-primary-color);
        }

        .module {
          padding-left: 14px;
          padding-right: 14px;
          padding-bottom: 14px;
        }

        .item {
          display: flex;
          padding: 20px;
          border-radius: 8px;
          background-color: white;
          border: 1px solid #ddd;
          max-width: 100%;
          margin: 16px auto 0 auto;
        }

        .pad {
          padding: 0 16px;
        }

        span {
          display: block;
        }

        .push-right {
          margin-left: auto;
        }

        .toggle {
          display: inline-block;
        }

        .hidden {
          display: none;
        }

        .block {
          display: block;
        }

        .blue {
          --mdc-theme-on-primary: white;
          --mdc-theme-primary: #3f51b5;
          --mdc-theme-on-secondary: white;
          --mdc-theme-secondary: #3f51b5;
        }

        .gray {
          --mdc-theme-on-primary: white;
          --mdc-theme-primary: rgba(0,0,0,0.37);
          --mdc-theme-on-secondary: white;
          --mdc-theme-secondary: rgba(0,0,0,0.37);
          cursor: pointer;
        }

        table {
          border-collapse: collapse;
          font-size: 13.3333px;
          width: 100%;
        }

        table, th, td {
          border: 1px solid #a8a8a8;
        }

        table, th, td {
          border: 1px solid #a8a8a8;
        }

        .recordNum {
          font-size: 13.3333px;
          font-style: italic;
        }
    `;
  }

  render() {
    return html`
      <app-header-layout fullbleed="">
        <app-header slot="header" condenses="" fixed="" effects="waterfall">
          <app-toolbar>
            <div main-title="">Sensor info</div>
            <mwc-icon @click="${this.openAddSensorDialog}">add_circle_outline</mwc-icon>
          </app-toolbar>
        </app-header>

        <div class="module">
          ${this.sensorDataModel && this.sensorDataModel.map((item, index) => html`
            <div class="item">
              <paper-toggle-button class="toggle" sizing="contain" id="toggle_${item.id}" @change="${this.sensorToggleChanged}"></paper-toggle-button>
              <div class="pad">
                <span>Sensor type: ${item.name}</span>
                <span>Frequency hint: ${item.frequency}</span>
                <span>Sensor activated: ${item.activated}</span>
                <span>${item.errorType}</span>
                <span>${item.errorMessage}</span>
                <span>${item.readingTimestamp}</span>
                <span>${item.readingValue0}</span>
                <span>${item.readingValue1}</span>
                <span>${item.readingValue2}</span>
                <span>${item.readingValue3}</span>
              </div>
              <mwc-icon id="${item.id}" @click="${this.removeSensor}" class="push-right">clear</mwc-icon>
            </div>
          `)}

          <div class="hidden" id="recordDiv">
            <mwc-button class="blue" dense @click="${this.startRecord}" label="Start Record"></mwc-button>
            <mwc-button class="gray" dense id="suspendRecord" @click="${this.suspendRecord}" label="Suspend"></mwc-button>
            <mwc-button class="gray" dense id="stopRecord" @click="${this.stopRecord}" label="Stop"></mwc-button><br>
            <input id="csvName"/><mwc-button class="gray" dense id="downloadRecord" @click="${this.downloadRecord}" label="Download"></mwc-button>
            <p class="recordNum">The number of current records is ${this.recordNum}<br><br></p>
            <table>
              <tr><th width="60%">CSV Name</td><th>Record Number</td></tr>
              ${this.csvList && this.csvList.map((item, index) => html`
                <tr><td>${item[0]}</td><td>${item[1]}</td></tr>
              `)}
            </table>
          </div>
        </div>
      </app-header-layout>

      <paper-toast id="toastNotSupported" text="Selected sensor is not supported."></paper-toast>
      <paper-toast id="toastPleaseSelectSensor" text="Please select sensor."></paper-toast>

      <paper-dialog id="addSensorDialog" modal="">
        <h2>Add sensor</h2>
        <paper-dropdown-menu-light id="selectedSensor" label="Sensor type">
          <paper-listbox class="dropdown-content" slot="dropdown-content">
            <paper-item>Ambient light</paper-item>
            <paper-item>Accelerometer</paper-item>
            <paper-item>LinearAcceleration</paper-item>
            <paper-item>Gyroscope</paper-item>
            <paper-item>Magnetometer</paper-item>
            <paper-item>AbsoluteOrientation</paper-item>
            <paper-item>RelativeOrientation</paper-item>
          </paper-listbox>
        </paper-dropdown-menu-light>
        <paper-input id="selectedFrequency" label="Frequency"></paper-input>
        <div class="buttons">
          <mwc-button class="blue" dialog-confirm @click="${this.addSensor}" label="Add"></mwc-button>
          <mwc-button class="blue" dialog-confirm autofocus label="Cancel"></mwc-button>
        </div>
      </paper-dialog>
    `;
  }
}

customElements.define('sensors-app', SensorsApp);
