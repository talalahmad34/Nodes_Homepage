/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// chrome.system.network isn't covered by @types/chrome — minimal ambient typing
// for just the pieces this extension uses (declaring the local IP in the footer).
declare namespace chrome.system.network {
  interface NetworkInterface {
    name: string;
    address: string;
    prefixLength: number;
  }

  function getNetworkInterfaces(callback: (interfaces: NetworkInterface[]) => void): void;

  const onNetworkLinkChanged: {
    addListener(callback: () => void): void;
    removeListener(callback: () => void): void;
  };
}
