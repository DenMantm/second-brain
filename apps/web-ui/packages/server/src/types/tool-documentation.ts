/**
 * Tool Documentation Types
 * Standard interface for tools to define their documentation for system prompts
 */

export interface ToolMetadata {
  name: string;
  usage: string;
}

export interface ToolDocumentation {
  /** Category heading (e.g., "YOUTUBE CAPABILITIES") */
  category: string;
  
  /** Brief description of what this tool category provides */
  description: string;
  
  /** List of tools with their usage examples */
  tools: ToolMetadata[];
  
  /** Valid command examples that should trigger these tools */
  validExamples: string[];
  
  /** Step-by-step instructions for using these tools */
  instructions: string[];
}

/**
 * Format tool documentation for inclusion in system prompt
 */
export function formatToolDocumentation(doc: ToolDocumentation): string {
  const lines: string[] = [];
  
  // Category header
  lines.push(`${doc.category}:`);
  lines.push(doc.description);
  
  // Tool list
  doc.tools.forEach(tool => {
    lines.push(`- ${tool.name}: ${tool.usage}`);
  });
  
  return lines.join('\n');
}

/**
 * Format tool instructions for inclusion in system prompt
 */
export function formatToolInstructions(doc: ToolDocumentation): string {
  return doc.instructions.join('\n');
}

/**
 * Get valid examples from all tool documentation
 */
export function getAllValidExamples(docs: ToolDocumentation[]): string[] {
  return docs.flatMap(doc => doc.validExamples);
}
