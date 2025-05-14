import * as vscode from 'vscode';
import { GoRouteCodeLensProvider, Route } from './codelens/GoRouteCodeLensProvider';
import { ProjectTreeProvider } from './tree/ProjectTreeProvider';

/**
 * Hàm kích hoạt extension
 */
export function activate(context: vscode.ExtensionContext) {
    // Đăng ký command khi click vào CodeLens trên từng route
    context.subscriptions.push(
        vscode.commands.registerCommand('goRouteExtension.codelensAction', (route: Route) => {
            vscode.window.showInformationMessage(`Route: ${route.method} ${route.path} (Line: ${route.line})`);
        })
    );

    // Đăng ký CodeLens provider cho file Go
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider('go', new GoRouteCodeLensProvider(context))
    );

    // ---- GOHB Sidebar ----
    // Đăng ký provider cho Sidebar Projects & Routes
    const gohbTreeProvider = new ProjectTreeProvider(context);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('gohbProjectRoutes', gohbTreeProvider)
    );

    // Đăng ký command để refresh sidebar (bạn gọi được trong mã lệnh hoặc menu)
    context.subscriptions.push(
        vscode.commands.registerCommand('gohbSidebar.moveToRoute', async (filePath: string, line: number) => {
            const doc = await vscode.workspace.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            const pos = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        })
    );

    // Để sau này muốn thêm RUN chỉ cần:
    context.subscriptions.push(
        vscode.commands.registerCommand('gohbSidebar.runRoute', (route: Route) => {
            vscode.window.showInformationMessage('Run not implemented yet!');
        })
    );
}

/**
 * Khi extension tắt
 */
export function deactivate() { }
