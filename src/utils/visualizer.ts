import fs from 'fs/promises';
import path from 'path';

/**
 * Gera um arquivo Mermaid.js Markdown para visualizar o fluxo
 */
export async function generateFlowDiagram(tenantId: string, flowId: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'src', 'tenants', tenantId, 'flows', `${flowId}.json`);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const flow = JSON.parse(content);

    let mermaid = 'graph TD\n';
    mermaid += `    Start((Início)) --> Step0\n`;
    
    // Styling
    mermaid += `    classDef finish fill:#f9f,stroke:#333,stroke-width:2px;\n`;
    mermaid += `    classDef wait fill:#e1f5fe,stroke:#01579b;\n`;
    mermaid += `    classDef action fill:#e8f5e9,stroke:#2e7d32;\n`;

    flow.steps.forEach((step: any, index: number) => {
        const isLast = index === flow.steps.length - 1;
        const nextStep = !isLast ? ` --> Step${index + 1}` : ' --> End((Fim)):::finish';
        
        // Shape and Style logic
        let shapeOpen = '[';
        let shapeClose = ']';
        let styleClass = ':::action';

        if (step.type === 'wait') {
            shapeOpen = '([';
            shapeClose = '])';
            styleClass = ':::wait';
        } else if (step.type === 'stopIfHasAnyTag') {
            shapeOpen = '{{';
            shapeClose = '}}';
            styleClass = ':::finish';
        } else if (step.type === 'conditionalChoice') {
            shapeOpen = '{';
            shapeClose = '}';
        }

        // Clean label for mermaid (remove special chars)
        const safeLabel = (step.label || step.type).replace(/["()]/g, '');
        const details = step.textKey || step.templateKey || step.seconds + 's' || '';
        const nodeText = `"${safeLabel} <br/> <small>${details}</small>"`;

        mermaid += `    Step${index}${shapeOpen}${nodeText}${shapeClose}${styleClass}${nextStep}\n`;

        // Handle textKey/templateKey nodes being self-explanatory
    });

    return mermaid;
  } catch (err) {
      return `graph TD\nError[Erro ao ler fluxo ${flowId}]`;
  }
}
