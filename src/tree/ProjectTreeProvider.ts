import * as vscode from 'vscode';
import { getAllProjectRoots } from '../utils/findProjects';
import { getRoutesForProject } from '../utils/getRoutesForProject';
import { Route } from '../codelens/GoRouteCodeLensProvider';

/** TreeItem for route entry */
class RouteTreeItem extends vscode.TreeItem {
    constructor(route: Route) {
        super(`${route.method} ${route.path}`, vscode.TreeItemCollapsibleState.None);
        this.description = `Line ${route.line}`;
        this.iconPath = new vscode.ThemeIcon('symbol-method');
        this.tooltip = `${route.method} ${route.path} (Line ${route.line})`;
        // Nếu bạn muốn: this.command = {...} // jump to line...
    }
}

/** TreeItem for root folder */
class ProjectTreeItem extends vscode.TreeItem {
    constructor(label: string, public readonly fullPath: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.tooltip = fullPath;
    }
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private projects: { label: string, fullPath: string, routes: Route[] }[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.refresh();
    }

    /** Gọi lại mỗi khi muốn load lại project/routes */
    async refresh() {
        this.projects = [];
        const projectRoots = await getAllProjectRoots();
        for (const fullPath of projectRoots) {
            const label = vscode.workspace.asRelativePath(fullPath);
            const routes = await getRoutesForProject(fullPath, this.context);
            this.projects.push({ label, fullPath, routes });
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // Top level: các project root (tên thư mục)
            return this.projects.map(
                proj => new ProjectTreeItem(proj.label, proj.fullPath)
            );
        }
        // Nếu click expand project thì trả về các route trong project đó
        if (element instanceof ProjectTreeItem) {
            const proj = this.projects.find(p => p.fullPath === element.fullPath);
            if (proj && proj.routes.length > 0) {
                return proj.routes.map(r => new RouteTreeItem(r));
            }
            return [new vscode.TreeItem('No routes found.', vscode.TreeItemCollapsibleState.None)];
        }
        return [];
    }
}
