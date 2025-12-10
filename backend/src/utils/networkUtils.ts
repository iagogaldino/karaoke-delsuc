import { networkInterfaces } from 'os';

/**
 * Detecta o IP da máquina na rede local
 * Prioriza IPv4 não-loopback e não-Docker
 * @returns O IP da máquina ou 'localhost' se não encontrar
 */
export function getLocalIP(): string {
  const interfaces = networkInterfaces();
  
  // Lista de interfaces a ignorar
  const ignoredInterfaces = ['lo', 'lo0', 'docker0', 'veth'];
  
  // Priorizar IPs que começam com 192.168, 10., ou 172.16-31 (redes privadas)
  const preferredPrefixes = ['192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];
  
  const foundIPs: Array<{ ip: string; priority: number }> = [];
  
  for (const interfaceName in interfaces) {
    // Ignorar interfaces específicas
    if (ignoredInterfaces.some(ignored => interfaceName.toLowerCase().includes(ignored))) {
      continue;
    }
    
    const addresses = interfaces[interfaceName];
    if (!addresses) continue;
    
    for (const address of addresses) {
      // Apenas IPv4 e não loopback
      if (address.family === 'IPv4' && !address.internal) {
        const ip = address.address;
        
        // Calcular prioridade (maior = melhor)
        let priority = 0;
        if (preferredPrefixes.some(prefix => ip.startsWith(prefix))) {
          priority = 10; // Alta prioridade para IPs de rede privada
        }
        
        // Priorizar 192.168.x.x (redes domésticas comuns)
        if (ip.startsWith('192.168.')) {
          priority = 20;
        }
        
        foundIPs.push({ ip, priority });
      }
    }
  }
  
  // Ordenar por prioridade (maior primeiro)
  foundIPs.sort((a, b) => b.priority - a.priority);
  
  // Retornar o IP com maior prioridade, ou o primeiro encontrado, ou localhost
  return foundIPs.length > 0 ? foundIPs[0].ip : 'localhost';
}

