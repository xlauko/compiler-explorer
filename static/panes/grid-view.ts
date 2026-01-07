// Copyright (c) 2026, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import {Container} from 'golden-layout';
import $ from 'jquery';
import * as monaco from 'monaco-editor';
import _ from 'underscore';

import {CompilationResult} from '../../types/compilation/compilation.interfaces.js';
import {CompilerInfo} from '../../types/compiler.interfaces.js';
import {Hub} from '../hub.js';
import {extendConfig} from '../monaco-config.js';
import {GridViewState} from './grid-view.interfaces.js';
import {MonacoPaneState} from './pane.interfaces.js';
import {MonacoPane} from './pane.js';

export class GridView extends MonacoPane<monaco.editor.IStandaloneCodeEditor, GridViewState> {
    constructor(hub: Hub, container: Container, state: GridViewState & MonacoPaneState) {
        super(hub, container, state);
        if (state.gridOutput) {
            this.showGridResults(state.gridOutput);
        } else {
            this.showGridResults([{text: '<No grid output>'}]);
        }
    }

    override getInitialHTML(): string {
        return $('#grid').html();
    }

    override createEditor(editorRoot: HTMLElement): void {
        this.editor = monaco.editor.create(
            editorRoot,
            extendConfig({
                language: 'mlir',
                readOnly: true,
                glyphMargin: true,
                lineNumbersMinChars: 3,
            }),
        );
    }

    override getPrintName() {
        return 'Grid Output';
    }

    override getDefaultPaneName(): string {
        return 'Grid View';
    }

    override registerCallbacks(): void {
        const throttleFunction = _.throttle(
            (event: monaco.editor.ICursorSelectionChangedEvent) => this.onDidChangeCursorSelection(event),
            500,
        );
        this.editor.onDidChangeCursorSelection(event => throttleFunction(event));
        this.eventHub.emit('gridViewOpened', this.compilerInfo.compilerId);
        this.eventHub.emit('requestSettings');
    }

    override getCurrentState(): MonacoPaneState & GridViewState {
        return {
            ...super.getCurrentState(),
        };
    }

    showGridResults(result: any[]): void {
        this.editor.getModel()?.setValue(result?.length ? _.pluck(result, 'text').join('\n') : '<No grid output>');

        if (!this.isAwaitingInitialResults) {
            if (this.selection) {
                this.editor.setSelection(this.selection);
                this.editor.revealLinesInCenter(this.selection.selectionStartLineNumber, this.selection.endLineNumber);
            }
            this.isAwaitingInitialResults = true;
        }
    }

    override onCompileResult(compilerId: number, compiler: CompilerInfo, result: CompilationResult): void {
        if (this.compilerInfo.compilerId !== compilerId) return;
        if (result.gridOutput) {
            this.showGridResults(result.gridOutput);
        } else {
            this.showGridResults([{text: '<No grid output>'}]);
        }
    }

    override onCompiler(
        compilerId: number,
        compiler: CompilerInfo | null,
        options: string,
        editorId?: number,
        treeId?: number,
    ): void {
        if (this.compilerInfo.compilerId === compilerId) {
            this.compilerInfo.compilerName = compiler ? compiler.name : '';
            this.compilerInfo.editorId = editorId;
            this.compilerInfo.treeId = treeId;
            this.updateTitle();
        }
    }

    override close(): void {
        this.eventHub.unsubscribe();
        this.eventHub.emit('gridViewClosed', this.compilerInfo.compilerId);
        this.editor.dispose();
    }
}
