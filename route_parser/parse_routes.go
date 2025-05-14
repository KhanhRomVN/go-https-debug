package main

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"regexp"
	"strings"
)

type Route struct {
	Method string   `json:"method"`
	Path   string   `json:"path"`
	Groups []string `json:"groups"`
	Line   int      `json:"line"`
}

var methods = regexp.MustCompile(`^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$`)

type groupMeta struct {
	fullPrefix string
	segments   []string
}

type scope struct {
	prefixes map[string]groupMeta
	parent   *scope
}

func newScope(parent *scope) *scope {
	return &scope{prefixes: map[string]groupMeta{}, parent: parent}
}
func getGroupMeta(s *scope, name string) groupMeta {
	for cur := s; cur != nil; cur = cur.parent {
		if pf, ok := cur.prefixes[name]; ok {
			return pf
		}
	}
	return groupMeta{}
}

func main() {
	if len(os.Args) < 2 {
		os.Exit(1)
	}
	filename := os.Args[1]
	fs := token.NewFileSet()
	node, err := parser.ParseFile(fs, filename, nil, parser.AllErrors)
	if err != nil {
		os.Exit(1)
	}
	var routes []Route

	var inspectFunc func(ast.Node, *scope)
	inspectFunc = func(n ast.Node, s *scope) {
		if n == nil {
			return
		}

		// Group assign
		if assign, ok := n.(*ast.AssignStmt); ok {
			for i, rhs := range assign.Rhs {
				if call, ok := rhs.(*ast.CallExpr); ok {
					if sel, ok := call.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Group" {
						if len(call.Args) > 0 {
							if bl, ok := call.Args[0].(*ast.BasicLit); ok && bl.Kind.String() == "STRING" {
								if ident, ok := assign.Lhs[i].(*ast.Ident); ok {
									parentMeta := groupMeta{}
									if recv, ok := sel.X.(*ast.Ident); ok {
										parentMeta = getGroupMeta(s, recv.Name)
									}
									thisSeg := trimQuotes(bl.Value)
									full := joinPath(parentMeta.fullPrefix, thisSeg)
									segments := append(append([]string{}, parentMeta.segments...), strings.Trim(thisSeg, "/"))
									s.prefixes[ident.Name] = groupMeta{fullPrefix: full, segments: segments}
								}
							}
						}
					}
				}
			}
		}
		// Route handler
		if expr, ok := n.(*ast.ExprStmt); ok {
			if call, ok := expr.X.(*ast.CallExpr); ok {
				if sel, ok := call.Fun.(*ast.SelectorExpr); ok && methods.MatchString(sel.Sel.Name) {
					recvName := ""
					if ident, ok := sel.X.(*ast.Ident); ok {
						recvName = ident.Name
					}
					meta := getGroupMeta(s, recvName)
					prefix := meta.fullPrefix
					path := ""
					if len(call.Args) > 0 {
						if bl, ok := call.Args[0].(*ast.BasicLit); ok && bl.Kind.String() == "STRING" {
							path = trimQuotes(bl.Value)
						}
					}
					line := fs.Position(call.Pos()).Line
					var groups []string
					for _, g := range meta.segments {
						g = strings.Trim(g, "/")
						if g != "" {
							groups = append(groups, g)
						}
					}
					fullPath := joinPath(prefix, path)
					routes = append(routes, Route{
						Method: sel.Sel.Name,
						Path:   fullPath,
						Groups: groups,
						Line:   line,
					})
				}
			}
		}
		// Recursion
		switch t := n.(type) {
		case *ast.BlockStmt:
			childScope := newScope(s)
			for _, stmt := range t.List {
				inspectFunc(stmt, childScope)
			}
		case *ast.File:
			for _, decl := range t.Decls {
				inspectFunc(decl, s)
			}
		case *ast.FuncDecl:
			inspectFunc(t.Body, s)
		case *ast.IfStmt:
			inspectFunc(t.Init, s)
			inspectFunc(t.Cond, s)
			inspectFunc(t.Body, s)
			inspectFunc(t.Else, s)
		case *ast.ForStmt:
			inspectFunc(t.Init, s)
			inspectFunc(t.Cond, s)
			inspectFunc(t.Post, s)
			inspectFunc(t.Body, s)
		case *ast.RangeStmt:
			inspectFunc(t.Key, s)
			inspectFunc(t.Value, s)
			inspectFunc(t.X, s)
			inspectFunc(t.Body, s)
		}
	}
	globalScope := newScope(nil)
	inspectFunc(node, globalScope)
	if len(routes) == 0 {
		os.Stdout.Write([]byte("[]"))
	} else {
		_ = json.NewEncoder(os.Stdout).Encode(routes)
	}
}

func trimQuotes(s string) string {
	return strings.Trim(s, "\"`'")
}
func joinPath(a, b string) string {
	a = strings.TrimRight(a, "/")
	b = strings.TrimLeft(b, "/")
	if a == "" {
		return "/" + b
	}
	if b == "" {
		return a
	}
	return a + "/" + b
}
