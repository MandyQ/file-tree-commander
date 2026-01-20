export interface FileNode {
  id: string;
  name: string;
  isFolder: boolean;
  children?: FileNode[];
}

export const mockSourceTree: FileNode = {
  id: "root",
  name: "project",
  isFolder: true,
  children: [
    {
      id: "src",
      name: "src",
      isFolder: true,
      children: [
        {
          id: "components",
          name: "components",
          isFolder: true,
          children: [
            { id: "header-tsx", name: "Header.tsx", isFolder: false },
            { id: "footer-tsx", name: "Footer.tsx", isFolder: false },
            { id: "sidebar-tsx", name: "Sidebar.tsx", isFolder: false },
          ],
        },
        {
          id: "utils",
          name: "utils",
          isFolder: true,
          children: [
            { id: "helpers-ts", name: "helpers.ts", isFolder: false },
            { id: "validators-ts", name: "validators.ts", isFolder: false },
          ],
        },
        {
          id: "hooks",
          name: "hooks",
          isFolder: true,
          children: [
            { id: "use-auth-ts", name: "useAuth.ts", isFolder: false },
            { id: "use-theme-ts", name: "useTheme.ts", isFolder: false },
          ],
        },
        { id: "app-tsx", name: "App.tsx", isFolder: false },
        { id: "main-tsx", name: "main.tsx", isFolder: false },
      ],
    },
    {
      id: "public",
      name: "public",
      isFolder: true,
      children: [
        { id: "logo-svg", name: "logo.svg", isFolder: false },
        { id: "favicon-ico", name: "favicon.ico", isFolder: false },
      ],
    },
    {
      id: "config",
      name: "config",
      isFolder: true,
      children: [
        { id: "vite-config-ts", name: "vite.config.ts", isFolder: false },
        { id: "tsconfig-json", name: "tsconfig.json", isFolder: false },
      ],
    },
    { id: "package-json", name: "package.json", isFolder: false },
    { id: "readme-md", name: "README.md", isFolder: false },
  ],
};

export const mockTargetTree: FileNode = {
  id: "target-root",
  name: "new-structure",
  isFolder: true,
  children: [],
};