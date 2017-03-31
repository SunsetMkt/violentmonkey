import { i18n } from 'src/common';
import { parseScript } from './db';
import * as scriptUtils from './script';

const processes = {};

function doCheckUpdate(script) {
  const res = {
    cmd: 'UpdateScript',
    data: {
      id: script.id,
      checking: true,
    },
  };
  const downloadURL = (
    script.custom.downloadURL
    || script.meta.downloadURL
    || script.custom.lastInstallURL
  );
  const updateURL = script.custom.updateURL || script.meta.updateURL || downloadURL;
  const okHandler = xhr => {
    const meta = scriptUtils.parseMeta(xhr.responseText);
    if (scriptUtils.compareVersion(script.meta.version, meta.version) < 0) return Promise.resolve();
    res.data.checking = false;
    res.data.message = i18n('msgNoUpdate');
    browser.runtime.sendMessage(res);
    return Promise.reject();
  };
  const errHandler = () => {
    res.data.checking = false;
    res.data.message = i18n('msgErrorFetchingUpdateInfo');
    browser.runtime.sendMessage(res);
    return Promise.reject();
  };
  const update = () => {
    if (!downloadURL) {
      res.data.message = `<span class="new">${i18n('msgNewVersion')}</span>`;
      browser.runtime.sendMessage(res);
      return Promise.reject();
    }
    res.data.message = i18n('msgUpdating');
    browser.runtime.sendMessage(res);
    return scriptUtils.fetch(downloadURL)
    .then(xhr => xhr.responseText, () => {
      res.data.checking = false;
      res.data.message = i18n('msgErrorFetchingScript');
      browser.runtime.sendMessage(res);
      return Promise.reject();
    });
  };
  if (!updateURL) return Promise.reject();
  res.data.message = i18n('msgCheckingForUpdate');
  browser.runtime.sendMessage(res);
  return scriptUtils.fetch(updateURL, null, {
    Accept: 'text/x-userscript-meta',
  })
  .then(okHandler, errHandler)
  .then(update);
}

export default function checkUpdate(script) {
  let promise = processes[script.id];
  if (!promise) {
    promise = doCheckUpdate(script)
    .then(code => {
      delete processes[script.id];
      return parseScript({
        code,
        id: script.id,
      })
      .then(res => {
        res.data.checking = false;
        browser.runtime.sendMessage(res);
      });
    }, () => {
      delete processes[script.id];
      // return Promise.reject();
    });
    processes[script.id] = promise;
  }
  return promise;
}
