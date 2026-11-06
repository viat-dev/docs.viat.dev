import { existsSync } from 'node:fs';
import path from 'node:path';
import { docsDirectory } from './content.mjs';

export const sections = [
  ['overview', '认识 Viat', 'Overview'],
  ['getting-started', '快速开始', 'Getting started'],
  ['installation', '安装与升级', 'Installation'],
  ['configuration', '配置参考', 'Configuration'],
  ['instance', '实例配置', 'Instance administration'],
  ['projects', '项目与协作', 'Projects'],
  ['auth', '认证与授权', 'Authentication and authorization'],
  ['assets/resources', '资源', 'Resources'],
  ['assets/scripts', '脚本', 'Scripts'],
  ['assets/workflows', '工作流', 'Workflows'],
  ['triggers', '接口与触发器', 'Endpoints and triggers'],
  ['testing', '测试', 'Testing'],
  ['publishing', '发布与版本', 'Publishing'],
  ['operations', '部署、运维与观测', 'Operations'],
  ['cli', 'CLI 命令', 'CLI commands'],
  ['mcp', 'MCP 工具', 'MCP tools'],
  ['api', 'HTTP API', 'HTTP API'],
  ['clients', '客户端', 'Clients'],
  ['applications', '典型应用', 'Applications'],
  ['reference', '版本与参考', 'Reference'],
];

// In-progress sections are not advertised as working links. Release coverage
// is checked separately, so omitting an unwritten sidebar cannot hide a gap.
export const sidebar = sections
  .filter(([directory]) => existsSync(path.join(docsDirectory(), 'zh-cn', directory)))
  .map(([directory, zh, en]) => ({
    label: en,
    translations: { 'zh-cn': zh },
    collapsed: true,
    items: [{ autogenerate: { directory, collapsed: true } }],
  }));
