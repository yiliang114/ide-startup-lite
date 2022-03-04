import { Injector } from '@opensumi/di';
import { ClientApp, IClientAppOpts, DEFAULT_WORKSPACE_STORAGE_DIR_NAME, StoragePaths, isWindows } from '@opensumi/ide-core-browser';
import { ensureDir } from '@opensumi/ide-core-common/lib/browser-fs/ensure-dir';
import { AbstractHttpFileService, BrowserFsProvider, BROWSER_HOME_DIR } from '../web-lite/file-provider/browser-fs-provider';
import * as BrowserFS from 'browserfs';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { HttpFileService } from '../web-lite/file-provider/http-file.service';
import { IDiskFileProvider } from '@opensumi/ide-file-service/lib/common';

export async function renderApp(opts: IClientAppOpts) {
  const injector = new Injector();
  opts.injector = injector;

  opts.workspaceDir = opts.workspaceDir || process.env.WORKSPACE_DIR;
  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST || 'http://localhost:8080/worker.host.js';
  opts.webviewEndpoint = opts.webviewEndpoint || `http://localhost:50998`;

  // TODO: 框架在新版本加了不允许覆盖file协议的限制，这里通过DI覆盖，后续需要确认下是否要必要加这个限制
  injector.addProviders({
    token: AbstractHttpFileService,
    useClass: HttpFileService,
  });
  const httpFs: AbstractHttpFileService = injector.get(AbstractHttpFileService);
  injector.addProviders({
    token: IDiskFileProvider,
    useValue: new BrowserFsProvider(httpFs, { rootFolder: opts.workspaceDir! }),
  });

  BrowserFS.configure({
    fs: "MountableFileSystem",
    options: {
      [opts.workspaceDir!]: { fs: "InMemory" },
      // home目录挂载到lcoalstorage来支持一些记录的持久化，不需要持久化可以注释掉
      // '/home': { fs: "LocalStorage", options: {} },
    }
  }, async function (e) {
    await setupAppDataDir(opts.workspaceDir!);

    const app = new ClientApp(opts);
    app.fireOnReload = (forcedReload: boolean) => {
      window.location.reload();
    };

    const targetDom = document.getElementById('main')!;
    await app.start((app) => {
      const MyApp = <div id='custom-wrapper' style={{ height: '100%', width: '100%' }}>{app}</div>;
      return new Promise((resolve) => {
        ReactDOM.render(MyApp, targetDom, resolve);
      });
    });
    const loadingDom = document.getElementById('loading');
    if (loadingDom) {
      loadingDom.classList.add('loading-hidden');
      loadingDom.remove();
    }
  });
}

async function setupAppDataDir(workspaceDir: string) {
  await ensureDir(workspaceDir);
  await ensureDir(BROWSER_HOME_DIR.codeUri.fsPath);

  if (isWindows) {
    await ensureDir(
      BROWSER_HOME_DIR.path.join(
        StoragePaths.WINDOWS_APP_DATA_DIR,
        StoragePaths.WINDOWS_ROAMING_DIR,
        DEFAULT_WORKSPACE_STORAGE_DIR_NAME,
      ).toString(),
    );
  } else {
    await ensureDir(BROWSER_HOME_DIR.path.join(DEFAULT_WORKSPACE_STORAGE_DIR_NAME).toString());
  }
}
