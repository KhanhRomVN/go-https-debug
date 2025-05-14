import * as vscode from 'vscode';
import { getAllProjectRoots } from '../utils/findProjects';
import { getRoutesForProject } from '../utils/getRoutesForProject';
import { Route } from '../codelens/GoRouteCodeLensProvider';
import * as path from 'path';

const methodIcons: Record<string, vscode.ThemeIcon> = {
    GET: new vscode.ThemeIcon('arrow-circle-right', new vscode.ThemeColor('charts.green')),
    POST: new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue')),
    PUT: new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.yellow')),
    DELETE: new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red')),
    PATCH: new vscode.ThemeIcon('wrench', new vscode.ThemeColor('charts.blue')),
    OPTIONS: new vscode.ThemeIcon('question', new vscode.ThemeColor('charts.purple')),
    HEAD: new vscode.ThemeIcon('chevron-up', new vscode.ThemeColor('charts.yellow')),
};

class RouteTreeItem extends vscode.TreeItem {
    constructor(
        public readonly route: Route,
        public readonly filePath: string
    ) {
        super(`${route.method} ${route.path}`, vscode.TreeItemCollapsibleState.None);
        this.description = `Line ${route.line}`;
        this.iconPath = methodIcons[route.method] || new vscode.ThemeIcon('arrow-right');
        this.contextValue = 'route';
        this.tooltip = `${route.method} ${route.path}\nFile: ${path.basename(filePath)}:${route.line}`;
        this.command = {
            command: 'gohbSidebar.moveToRoute',
            title: 'Go to route',
            arguments: [filePath, route.line]
        };
    }
}

class ResourceGroupTreeItem extends vscode.TreeItem {
    children: (ResourceGroupTreeItem | RouteTreeItem)[] = [];
    constructor(public readonly name: string) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'resourceGroup';
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}

class FileTreeItem extends vscode.TreeItem {
    constructor(label: string, public resources: ResourceGroupTreeItem[]) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.contextValue = 'fileGroup';
    }
}

class ProjectTreeItem extends vscode.TreeItem {
    constructor(label: string, public fullPath: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.tooltip = fullPath;
        this.contextValue = 'projectRoot';
    }
}

// Đệ quy group N cấp qua route.groups
function buildResourceTreeDynamic(
    routes: { route: any; file: string }[],
    depth: number = 0
): (ResourceGroupTreeItem | RouteTreeItem)[] {
    const groupMap: Record<string, { route: any; file: string }[]> = {};
    const leafRoutes: { route: any; file: string }[] = [];

    for (const r of routes) {
        const groups: string[] = Array.isArray(r.route.groups) ? r.route.groups : [];
        if (groups.length > depth && groups[depth]) {
            const key = groups[depth];
            if (!groupMap[key]) groupMap[key] = [];
            groupMap[key].push(r);
        } else {
            leafRoutes.push(r);
        }
    }

    const items: (ResourceGroupTreeItem | RouteTreeItem)[] = [];

    for (const key of Object.keys(groupMap).sort()) {
        const node = new ResourceGroupTreeItem(key);
        node.children = buildResourceTreeDynamic(groupMap[key], depth + 1);
        items.push(node);
    }
    for (const r of leafRoutes) {
        items.push(new RouteTreeItem(r.route, r.file));
    }
    return items;
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private projects: {
        label: string;
        fullPath: string;
        files: FileTreeItem[];
    }[] = [];
    constructor(private context: vscode.ExtensionContext) {
        this.refresh();
    }
    async refresh() {
        this.projects = [];
        const projectRoots = await getAllProjectRoots();
        for (const projectFullPath of projectRoots) {
            const label = vscode.workspace.asRelativePath(projectFullPath);
            const rawRoutes = await getRoutesForProject(projectFullPath, this.context);
            const byFile: Record<string, { route: Route; file: string }[]> = {};
            for (const r of rawRoutes) {
                const { __file, ...pureRoute } = r as any;
                if (!byFile[__file]) byFile[__file] = [];
                byFile[__file].push({ route: pureRoute as Route, file: __file });
            }
            const files: FileTreeItem[] = [];
            for (const filePath of Object.keys(byFile).sort()) {
                const fileLabel = path.basename(filePath);
                files.push(new FileTreeItem(fileLabel, buildResourceTreeDynamic(byFile[filePath], 0) as ResourceGroupTreeItem[]));
            }
            this.projects.push({ label, fullPath: projectFullPath, files });
        }
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }
    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            return this.projects.map((proj) => new ProjectTreeItem(proj.label, proj.fullPath));
        }
        if (element instanceof ProjectTreeItem) {
            const proj = this.projects.find((p) => p.fullPath === element.fullPath);
            return proj ? proj.files : [];
        }
        if (element instanceof FileTreeItem) {
            return element.resources;
        }
        if (element instanceof ResourceGroupTreeItem) {
            return element.children;
        }
        return [];
    }
}
