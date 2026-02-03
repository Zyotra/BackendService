export default function parseTableNames(tables: string[]): string[] {
    // Basic implementation to filter out empty lines or headers/footers if typical psql output
    return tables.filter(t => t && t.trim() !== '' && !t.includes('table_name') && !t.includes('---') && !t.includes('rows)'));
}
