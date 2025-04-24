import * as vscode from "vscode";
import { DebugSession, ExitedEvent, InitializedEvent, TerminatedEvent } from "@vscode/debugadapter";
import { getWorkspaceFolder } from "./workspace";
import { Configuration } from "./configuration";
import { logMessage } from "./logger";

export class RenpyAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterInlineImplementation(new RenpyDebugSession(session.configuration.command, session.configuration.args));
    }
}

class RenpyDebugSession extends DebugSession {
    private command = "run";
    private args?: string[];

    private terminal?: vscode.Terminal;

    public constructor(command: string, args?: string[]) {
        super();
        this.command = command;
        if (args) {
            this.args = args;
        }
    }

    protected override initializeRequest(): void {
        const localArgs = [getWorkspaceFolder()];
        if (this.command) {
            localArgs.push(this.command);
        }
        if (this.args) {
            localArgs.push(...this.args);
        }

        const terminalName = "Ren'py Debug";
        const terminalOptions: vscode.TerminalOptions = {
            name: terminalName,
            shellPath: Configuration.getRenpyExecutablePath(),
            shellArgs: localArgs,
            cwd: getWorkspaceFolder(),
            message: "Opening Ren'Py",
        };

        this.terminal = vscode.window.createTerminal(terminalOptions);

        logMessage(vscode.LogLevel.Debug, "Ren'Py terminal started");
        this.sendEvent(new InitializedEvent());
        vscode.window.onDidCloseTerminal((t) => {
            if (t.name === terminalName) {
                console.log("Ren'Py terminal closed");
                logMessage(vscode.LogLevel.Debug, "Ren'Py terminal closed");
                this.sendEvent(new ExitedEvent(t.exitStatus?.code ?? -1));
                this.sendEvent(new TerminatedEvent());
            }
        });
    }

    protected override terminateRequest(): void {
        if (this.terminal) {
            this.terminal.dispose();
        }
    }
}

export class RenpyConfigurationProvider implements vscode.DebugConfigurationProvider {
    resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): vscode.ProviderResult<vscode.DebugConfiguration> {
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === "renpy") {
                config.type = "renpy";
                config.request = "launch";
                config.name = "Ren'Py: Launch";
                config.command = "run";
                config.args = [];
            }
        }
        return config;
    }
}
