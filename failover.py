# -*- coding: utf-8 -*-
"""
NetFailover - Alternador Automático Inteligente de Conexões (Cabo + Celular 5G)
Elimina a necessidade de desativar/ativar manualmente os adaptadores de rede no Windows.
"""

import sys
import os
import time
import socket
import json
import subprocess
import signal
import atexit
import ctypes

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

DEFAULT_CONFIG = {
    "primary_interface": "Ethernet",
    "secondary_interface": "",
    "check_interval_seconds": 1.0,
    "socket_timeout_seconds": 1.2,
    "fail_threshold": 2,
    "recovery_threshold": 3,
    "primary_active_metric": 10,
    "primary_inactive_metric": 9999,
    "secondary_active_metric": 10,
    "secondary_standby_metric": 50,
    "test_targets": [
        {"host": "1.1.1.1", "port": 80},
        {"host": "8.8.8.8", "port": 53},
        {"host": "1.0.0.1", "port": 80}
    ]
}

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def elevate_privileges():
    if not is_admin():
        print("\n" + "=" * 60)
        print(" [!] Permissões de Administrador necessárias.")
        print(" Solicitando elevação do Windows (UAC)...")
        print("=" * 60 + "\n")
        script = os.path.abspath(sys.argv[0])
        params = " ".join([f'"{arg}"' for arg in sys.argv[1:]])
        hinstance = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, f'"{script}" {params}', None, 1
        )
        if hinstance > 32:
            sys.exit(0)
        else:
            print("\n[ERRO] Elevação recusada pelo usuário.")
            print("O programa precisa de permissão de Administrador para ajustar rotas de rede.")
            input("\nPressione Enter para fechar...")
            sys.exit(1)

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8-sig") as f:
                cfg = json.load(f)
                return {**DEFAULT_CONFIG, **cfg}
        except Exception as e:
            print(f"[AVISO] Falha ao ler config.json ({e}). Usando configurações padrão.")
    return DEFAULT_CONFIG

def get_network_interfaces():
    cmd = [
        "powershell", "-NoProfile", "-Command",
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
        "$ifaces = Get-NetIPInterface -AddressFamily IPv4 | Select-Object ifIndex, InterfaceAlias, InterfaceMetric, ConnectionState; "
        "$ips = Get-NetIPAddress -AddressFamily IPv4 | Select-Object ifIndex, IPAddress; "
        "$result = @(); "
        "foreach ($iface in $ifaces) { "
        "    $ipObj = $ips | Where-Object { $_.ifIndex -eq $iface.ifIndex } | Select-Object -First 1; "
        "    $ip = if ($ipObj) { $ipObj.IPAddress } else { '' }; "
        "    $result += [PSCustomObject]@{ "
        "        ifIndex = $iface.ifIndex; "
        "        InterfaceAlias = $iface.InterfaceAlias; "
        "        InterfaceMetric = $iface.InterfaceMetric; "
        "        ConnectionState = $iface.ConnectionState; "
        "        IPAddress = $ip "
        "    }; "
        "}; "
        "$result | ConvertTo-Json"
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8-sig", check=True)
        data = json.loads(proc.stdout)
        if isinstance(data, dict):
            data = [data]
        return data
    except Exception as e:
        print(f"[ERRO] Falha ao consultar interfaces: {e}")
        return []

def probe_adapter(source_ip, targets, timeout=1.2):
    if not source_ip or source_ip.startswith("169.254.") or source_ip.startswith("127."):
        return False, None

    for target in targets:
        host = target["host"]
        port = target["port"]
        t_start = time.perf_counter()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            s.bind((source_ip, 0))
            s.connect((host, port))
            s.close()
            latency_ms = int((time.perf_counter() - t_start) * 1000)
            return True, latency_ms
        except Exception:
            try:
                s.close()
            except Exception:
                pass
    return False, None

def set_interface_metric(if_index, metric):
    cmd = [
        "powershell", "-NoProfile", "-Command",
        f"Set-NetIPInterface -InterfaceIndex {if_index} -InterfaceMetric {metric}"
    ]
    subprocess.run(cmd, capture_output=True)

def reset_interface_metric(if_index):
    cmd = [
        "powershell", "-NoProfile", "-Command",
        f"Set-NetIPInterface -InterfaceIndex {if_index} -AutomaticMetric Enabled"
    ]
    subprocess.run(cmd, capture_output=True)

def flush_dns():
    cmd = ["powershell", "-NoProfile", "-Command", "Clear-DnsClientCache"]
    subprocess.run(cmd, capture_output=True)

primary_info = None
secondary_info = None
current_state = "NORMAL"

def cleanup():
    print("\n\n[INFO] Encerrando NetFailover...")
    if primary_info:
        print(f"[*] Restaurando métrica automática para: {primary_info['InterfaceAlias']} (Index {primary_info['ifIndex']})")
        reset_interface_metric(primary_info["ifIndex"])
    if secondary_info:
        print(f"[*] Restaurando métrica automática para: {secondary_info['InterfaceAlias']} (Index {secondary_info['ifIndex']})")
        reset_interface_metric(secondary_info["ifIndex"])
    flush_dns()
    print("[OK] Métricas do Windows restauradas com sucesso.")

atexit.register(cleanup)

def signal_handler(sig, frame):
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    global primary_info, secondary_info, current_state
    
    elevate_privileges()
    
    try:
        ctypes.windll.kernel32.SetConsoleTitleW("NetFailover - Monitor de Conexão Cabo + Celular")
    except Exception:
        pass

    cfg = load_config()

    print("=" * 65)
    print("      NETFAILOVER - Alternância Automática Cabo + Celular        ")
    print("=" * 65)
    print(" Monitorando conexões para evitar que você precise desativar     ")
    print(" manualmente seus adaptadores de rede.                           ")
    print(" Pressione Ctrl+C a qualquer momento para sair e restaurar.       ")
    print("=" * 65 + "\n")

    fail_count = 0
    recovery_count = 0
    metrics_initialized = False

    while True:
        interfaces = get_network_interfaces()
        
        # 1. Identificar interface primária (Cabo / Ethernet)
        primary_match = cfg.get("primary_interface", "Ethernet").lower()
        found_primary = None
        for iface in interfaces:
            if primary_match in iface["InterfaceAlias"].lower():
                found_primary = iface
                break
        
        if not found_primary:
            print(f"[ERRO CRÍTICO] Interface primária '{cfg.get('primary_interface')}' não foi encontrada.")
            time.sleep(3)
            continue
        
        primary_info = found_primary

        # 2. Identificar interface secundária (Celular: USB Tethering, Wi-Fi, etc.)
        secondary_match = cfg.get("secondary_interface", "").strip().lower()
        found_secondary = None
        
        for iface in interfaces:
            if iface["ifIndex"] == primary_info["ifIndex"] or iface["ifIndex"] == 1:
                continue
            
            if secondary_match and secondary_match in iface["InterfaceAlias"].lower():
                if iface["ConnectionState"] == 1 and iface["IPAddress"] and not iface["IPAddress"].startswith("169.254."):
                    found_secondary = iface
                    break
            elif not secondary_match:
                if iface["ConnectionState"] == 1 and iface["IPAddress"] and not iface["IPAddress"].startswith("169.254."):
                    found_secondary = iface
                    break

        secondary_info = found_secondary

        # 3. Testar conectividade da primária (Cabo)
        prim_ok, prim_lat = probe_adapter(
            primary_info["IPAddress"],
            cfg["test_targets"],
            timeout=cfg["socket_timeout_seconds"]
        )

        # 4. Testar conectividade da secundária (se existir)
        sec_ok, sec_lat = (False, None)
        if secondary_info:
            sec_ok, sec_lat = probe_adapter(
                secondary_info["IPAddress"],
                cfg["test_targets"],
                timeout=cfg["socket_timeout_seconds"]
            )

        now_str = time.strftime("%H:%M:%S")

        # Inicializar métricas padrão na primeira execução
        if not metrics_initialized and current_state == "NORMAL":
            set_interface_metric(primary_info["ifIndex"], cfg["primary_active_metric"])
            if secondary_info:
                set_interface_metric(secondary_info["ifIndex"], cfg["secondary_standby_metric"])
            metrics_initialized = True

        # 5. Máquina de Estados e Lógica de Decisão
        if current_state == "NORMAL":
            if prim_ok:
                fail_count = 0
                sec_status_str = f"OK ({sec_lat}ms) [Standby]" if sec_ok else ("Sem internet" if secondary_info else "Aguardando conexão (USB/Wi-Fi)")
                print(f"[{now_str}] CABO: OK ({prim_lat}ms) | CELULAR: {sec_status_str} | MODO: Normal (Cabo)")
            else:
                fail_count += 1
                print(f"[{now_str}] [ALERTA] Falha detectada no CABO ({fail_count}/{cfg['fail_threshold']})")
                
                if fail_count >= cfg["fail_threshold"]:
                    if secondary_info and sec_ok:
                        print("\n" + "=" * 65)
                        print(f"[{now_str}] 🚨 INTERNET DO CABO CAIU!")
                        print(f"[*] Alterando métricas para transferir tráfego para: {secondary_info['InterfaceAlias']}")
                        print("=" * 65 + "\n")
                        
                        set_interface_metric(primary_info["ifIndex"], cfg["primary_inactive_metric"])
                        set_interface_metric(secondary_info["ifIndex"], cfg["secondary_active_metric"])
                        flush_dns()
                        
                        current_state = "FAILOVER"
                        recovery_count = 0
                    elif secondary_info and not sec_ok:
                        print(f"[{now_str}] [AVISO] Cabo falhou, mas celular também está sem resposta de internet!")
                    else:
                        print(f"[{now_str}] [AVISO] Cabo falhou, mas nenhum celular/Wi-Fi secundário está conectado!")

        elif current_state == "FAILOVER":
            sec_status_str = f"OK ({sec_lat}ms) [ATIVO]" if sec_ok else "Falhando"
            
            if prim_ok:
                recovery_count += 1
                print(f"[{now_str}] CABO: Respondendo ({prim_lat}ms) - Confirmando estabilidade ({recovery_count}/{cfg['recovery_threshold']}) | CELULAR: {sec_status_str}")
                
                if recovery_count >= cfg["recovery_threshold"]:
                    print("\n" + "=" * 65)
                    print(f"[{now_str}] ✅ CABO DE REDE VOLTOU E ESTABILIZOU!")
                    print(f"[*] Restaurando prioridade principal para: {primary_info['InterfaceAlias']}")
                    print("=" * 65 + "\n")
                    
                    set_interface_metric(primary_info["ifIndex"], cfg["primary_active_metric"])
                    if secondary_info:
                        set_interface_metric(secondary_info["ifIndex"], cfg["secondary_standby_metric"])
                    flush_dns()
                    
                    current_state = "NORMAL"
                    fail_count = 0
            else:
                recovery_count = 0
                print(f"[{now_str}] CABO: Inoperante | CELULAR: {sec_status_str} | MODO: FAILOVER (Celular)")

        time.sleep(cfg["check_interval_seconds"])

if __name__ == "__main__":
    main()

