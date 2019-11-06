// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ActivityMonitor, PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Message } from '@phosphor/messaging';
import { Widget } from '@phosphor/widgets';
import { IHeading } from './utils/headings';
import { TableOfContentsRegistry as Registry } from './registry';
import { TOCTree } from './toc_tree';

/**
 * Interface describing table of contents widget options.
 */
interface IOptions {
  /**
   * Application document manager.
   */
  docmanager: IDocumentManager;

  /**
   * Application rendered MIME type.
   */
  rendermime: IRenderMimeRegistry;
}

/**
 * Interface describing the current widget.
 */
interface ICurrentWidget<W extends Widget = Widget> {
  /**
   * Current widget.
   */
  widget: W;

  /**
   * Table of contents generator for the current widget.
   */
  generator: Registry.IGenerator<W>;
}

/**
 * Timeout for throttling ToC rendering.
 *
 * @private
 */
const RENDER_TIMEOUT = 1000;

/**
 * Widget for hosting a notebook table of contents.
 */
class TableOfContents extends Widget {
  /**
   * Returns a new table of contents.
   *
   * @param options - options
   * @returns widget
   */
  constructor(options: IOptions) {
    super();
    this._docmanager = options.docmanager;
    this._rendermime = options.rendermime;
  }

  /**
   * Current widget-generator tuple for the ToC.
   */
  get current(): ICurrentWidget | null {
    return this._current;
  }
  set current(value: ICurrentWidget | null) {
    // If they are the same as previously, do nothing...
    if (
      value &&
      this._current &&
      this._current.widget === value.widget &&
      this._current.generator === value.generator
    ) {
      return;
    }
    this._current = value;

    if (this.generator && this.generator.toolbarGenerator) {
      this._toolbar = this.generator.toolbarGenerator();
    }
    // Dispose an old activity monitor if one existed...
    if (this._monitor) {
      this._monitor.dispose();
      this._monitor = null;
    }
    // If we are wiping the ToC, update and return...
    if (!this._current) {
      this.update();
      return;
    }
    // Find the document model associated with the widget:
    const context = this._docmanager.contextForWidget(this._current.widget);
    if (!context || !context.model) {
      throw Error('Could not find a context for the Table of Contents');
    }
    // Throttle the rendering rate of the table of contents:
    this._monitor = new ActivityMonitor({
      signal: context.model.contentChanged,
      timeout: RENDER_TIMEOUT
    });
    this._monitor.activityStopped.connect(this.update, this);
    this.update();
  }

  /**
   * Updates a table of contents.
   */
  update() {
    let toc: IHeading[] = [];
    let title = 'Table of Contents';
    if (this._current) {
      toc = this._current.generator.generate(this._current.widget);
      const context = this._docmanager.contextForWidget(this._current.widget);
      if (context) {
        title = PathExt.basename(context.localPath);
      }
    }
    let itemRenderer: (item: IHeading) => JSX.Element | null = (
      item: IHeading
    ) => {
      return <span>{item.text}</span>;
    };
    if (this._current && this._current.generator.itemRenderer) {
      itemRenderer = this._current.generator.itemRenderer!;
    }
    let jsx = (
      <div className="jp-TableOfContents">
        <header>{title}</header>
      </div>
    );
    if (this._current && this._current.generator) {
      jsx = (
        <TOCTree
          title={title}
          toc={toc}
          generator={this.generator}
          itemRenderer={itemRenderer}
          toolbar={this._toolbar}
        />
      );
    }
    ReactDOM.render(jsx, this.node, () => {
      if (
        this._current &&
        this._current.generator.usesLatex === true &&
        this._rendermime.latexTypesetter
      ) {
        this._rendermime.latexTypesetter.typeset(this.node);
      }
    });
  }

  /**
   * Current table of contents generator.
   *
   * @returns table of contents generator
   */
  get generator() {
    if (this._current) {
      return this._current.generator;
    }
    return null;
  }

  /**
   * Callback invoked upon an update request.
   *
   * @param msg - message
   */
  protected onUpdateRequest(msg: Message): void {
    // Don't bother if the ToC is not visible...
    /* if (!this.isVisible) {
      return;
    } */
    this.update();
  }

  /**
   * Callback invoked to re-render after showing a table of contents.
   *
   * @param msg - message
   */
  protected onAfterShow(msg: Message): void {
    this.update();
  }

  private _toolbar: any;
  private _rendermime: IRenderMimeRegistry;
  private _docmanager: IDocumentManager;
  private _current: ICurrentWidget | null;
  private _monitor: ActivityMonitor<any, any> | null;
}

/**
 * Exports.
 */
export { TableOfContents };
