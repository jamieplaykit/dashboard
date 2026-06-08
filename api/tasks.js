module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const gistId = 'f047475250286c0388bffe1b7275d8e0';

  if (!anthropicKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const today = new Date().toISOString().split('T')[0];
    const windowLabel = req.body.windowLabel || 'today';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are a personal assistant for Jamie, a Strategy Lead. Today is ${today}. Use MCP tools to gather tasks from all connected sources. Respond ONLY with a JSON array, no markdown:
[{"text":"task","source":"notion|granola|slack|gmail|gcal","due":"YYYY-MM-DD or null","priority":"high|medium|low","group":"overdue|today|tomorrow|this_week|this_month|someday"}]`,
        messages: [{ role: 'user', content: `Gather all tasks and action items due ${windowLabel} from Notion, Granola, Slack, Gmail, and Google Calendar. Return only a JSON array.` }],
        mcp_servers: [
          { type: 'url', url: 'https://mcp.notion.com/mcp', name: 'notion' },
          { type: 'url', url: 'https://mcp.granola.ai/mcp', name: 'granola' },
          { type: 'url', url: 'https://mcp.slack.com/mcp', name: 'slack' },
          { type: 'url', url: 'https://gmailmcp.googleapis.com/mcp/v1', name: 'gmail' },
          { type: 'url', url: 'https://calendarmcp.googleapis.com/mcp/v1', name: 'gcal' }
        ]
      })
    });

    const data = await response.json();
    const raw = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '[]';
    const clean = raw.replace(/```json|```/g, '').trim();
    const tasks = JSON.parse(clean);

    // Write to GitHub Gist
    if (githubToken) {
      await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: {
            'tasks.json': { content: JSON.stringify(tasks) }
          }
        })
      });
    }

    res.status(200).json(tasks);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
