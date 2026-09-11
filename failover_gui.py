# -*- coding: utf-8 -*-
"""
NetFailover GUI - Interface Gráfica para Alternância Automática de Rede
Monitora Cabo de Rede + Celular 5G com failover instantâneo no Windows.
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
import threading
import queue
import tkinter as tk
from tkinter import ttk, messagebox
from tkinter.scrolledtext import ScrolledText

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
        script = os.path.abspath(sys.argv[0])
        params = " ".join([f'"{arg}"' for arg in sys.argv[1:]])
        # Usa pythonw se disponível para não abrir terminal preto
        exe = sys.executable
        hinstance = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", exe, f'"{script}" {params}', None, 1
        )
        if hinstance > 32:
            sys.exit(0)
        else:
            # Se o usuário recusar a janela UAC
            root_err = tk.Tk()
            root_err.withdraw()
            messagebox.showerror(
                "Permissão Necessária",
                "O NetFailover precisa de permissões de Administrador para alterar as rotas de rede do Windows.\n\nPor favor, execute o programa como Administrador."
            )
            root_err.destroy()
            sys.exit(1)

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8-sig") as f:
                cfg = json.load(f)
                return {**DEFAULT_CONFIG, **cfg}
        except Exception:
            pass
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
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", check=True)
        data = json.loads(proc.stdout)
        if isinstance(data, dict):
            data = [data]
        return data
    except Exception:
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


class NetFailoverApp(tk.Tk):
    def __init__(self):
        super().__init__()
        
        self.title("NetFailover - Monitor de Conexões")
        self.geometry("760x650")
        self.minsize(720, 600)
        self.configure(bg="#181825")
        
        # Centralizar janela na tela
        self.center_window()
        
        self.cfg = load_config()
        self.update_queue = queue.Queue()
        self.monitor_thread = None
        self.is_monitoring = threading.Event()
        self.is_monitoring.set()
        self.stop_event = threading.Event()
        
        self.primary_info = None
        self.secondary_info = None
        self.current_mode = "NORMAL"
        
        # Paleta de Cores Moderna (Dark Slate)
        self.c_bg = "#181825"
        self.c_card = "#232334"
        self.c_card_border = "#313244"
        self.c_text = "#cdd6f4"
        self.c_text_muted = "#9399b2"
        self.c_accent = "#89b4fa"
        self.c_green = "#a6e3a1"
        self.c_green_bg = "#1e382b"
        self.c_red = "#f38ba8"
        self.c_red_bg = "#3d1e28"
        self.c_yellow = "#f9e2af"
        self.c_yellow_bg = "#3a341c"
        
        self.build_ui()
        
        # Iniciar thread trabalhadora
        self.start_worker_thread()
        
        # Iniciar checagem periódica da fila
        self.after(100, self.process_queue)
        
        # Interceptar fechamento para cleanup seguro
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

    def center_window(self):
        self.update_idletasks()
        w = 760
        h = 650
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    def build_ui(self):
        # 1. Header Frame
        header = tk.Frame(self, bg=self.c_bg, padx=20, pady=15)
        header.pack(fill="x")
        
        title_box = tk.Frame(header, bg=self.c_bg)
        title_box.pack(side="left")
        
        lbl_title = tk.Label(
            title_box, text="NetFailover 🚀", font=("Segoe UI", 18, "bold"),
            fg=self.c_text, bg=self.c_bg
        )
        lbl_title.pack(anchor="w")
        
        lbl_sub = tk.Label(
            title_box, text="Alternância Inteligente • Cabo + Celular 5G (Sem desativar placas)",
            font=("Segoe UI", 9), fg=self.c_text_muted, bg=self.c_bg
        )
        lbl_sub.pack(anchor="w")
        
        # Badge de Estado Geral
        self.badge_status = tk.Label(
            header, text="● INICIALIZANDO...", font=("Segoe UI", 10, "bold"),
            fg=self.c_yellow, bg=self.c_yellow_bg, padx=12, pady=6, relief="flat"
        )
        self.badge_status.pack(side="right")
        
        # 2. Container dos Cards de Conexão
        cards_container = tk.Frame(self, bg=self.c_bg, padx=20, pady=5)
        cards_container.pack(fill="x")
        cards_container.columnconfigure(0, weight=1)
        cards_container.columnconfigure(1, weight=1)
        
        # Card 1: Cabo de Rede (Ethernet)
        self.card_cable = tk.Frame(
            cards_container, bg=self.c_card, highlightbackground=self.c_card_border,
            highlightthickness=1, padx=15, pady=15
        )
        self.card_cable.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        
        tk.Label(
            self.card_cable, text="🌐 Cabo de Rede (Ethernet)", font=("Segoe UI", 12, "bold"),
            fg=self.c_text, bg=self.c_card
        ).pack(anchor="w")
        
        self.lbl_cable_status = tk.Label(
            self.card_cable, text="Verificando...", font=("Segoe UI", 9, "bold"),
            fg=self.c_yellow, bg=self.c_yellow_bg, padx=8, pady=3
        )
        self.lbl_cable_status.pack(anchor="w", pady=(8, 10))
        
        self.lbl_cable_ip = tk.Label(
            self.card_cable, text="IP: Identificando...", font=("Segoe UI", 9),
            fg=self.c_text_muted, bg=self.c_card
        )
        self.lbl_cable_ip.pack(anchor="w", pady=2)
        
        self.lbl_cable_lat = tk.Label(
            self.card_cable, text="Latência: -- ms", font=("Segoe UI", 9),
            fg=self.c_text_muted, bg=self.c_card
        )
        self.lbl_cable_lat.pack(anchor="w", pady=2)
        
        self.lbl_cable_metric = tk.Label(
            self.card_cable, text="Prioridade: Métrica --", font=("Segoe UI", 9),
            fg=self.c_text_muted, bg=self.c_card
        )
        self.lbl_cable_metric.pack(anchor="w", pady=2)
        
        # Card 2: Celular (5G / Wi-Fi / Tethering)
        self.card_cell = tk.Frame(
            cards_container, bg=self.c_card, highlightbackground=self.c_card_border,
            highlightthickness=1, padx=15, pady=15
        )
        self.card_cell.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        
        tk.Label(
            self.card_cell, text="📱 Celular (5G / Wi-Fi)", font=("Segoe UI", 12, "bold"),
            fg=self.c_text, bg=self.c_card
        ).pack(anchor="w")
        
        self.lbl_cell_status = tk.Label(
            self.card_cell, text="Aguardando conexão...", font=("Segoe UI", 9, "bold"),
            fg=self.c_text_muted, bg="#2a2a3c", padx=8, pady=3
        )
        self.lbl_cell_status.pack(anchor="w", pady=(8, 10))
        
        self.lbl_cell_ip = tk.Label(
            self.card_cell, text="IP: Não conectado", font=("Segoe UI", 9),
            fg=self.c_text_muted, bg=self.c_card
        )
        self.lbl_cell_ip.pack(anchor="w", pady=2)
        
        self.lbl_cell_lat = tk.Label(
            self.card_cell, text="Latência: -- ms", font=("Segoe UI", 9),
            fg=self.c_text_muted, bg=self.c_card
        )
        self.lbl_cell_lat.pack(anchor="w", pady=2)
        
        self.lbl_cell_metric = tk.Label(
            self.card_cell, text="Prioridade: Standby", font=("Segoe UI", 9),
            fg=self.c_text_muted, bg=self.c_card
        )
        self.lbl_cell_metric.pack(anchor="w", pady=2)
        
        # 3. Painel de Ações e Controles
        ctrl_frame = tk.Frame(self, bg=self.c_bg, padx=20, pady=12)
        ctrl_frame.pack(fill="x")
        
        self.btn_pause = tk.Button(
            ctrl_frame, text="⏸ Pausar Monitoramento", font=("Segoe UI", 9, "bold"),
            bg="#313244", fg=self.c_text, activebackground="#45475a", activeforeground="#ffffff",
            relief="flat", padx=12, pady=6, cursor="hand2", command=self.toggle_monitoring
        )
        self.btn_pause.pack(side="left", padx=(0, 8))
        
        self.btn_switch_test = tk.Button(
            ctrl_frame, text="⚡ Testar Failover Manual", font=("Segoe UI", 9),
            bg="#313244", fg=self.c_accent, activebackground="#45475a", activeforeground="#ffffff",
            relief="flat", padx=12, pady=6, cursor="hand2", command=self.force_manual_switch
        )
        self.btn_switch_test.pack(side="left", padx=(0, 8))
        
        btn_reset = tk.Button(
            ctrl_frame, text="↺ Restaurar Padrões Windows", font=("Segoe UI", 9),
            bg="#313244", fg=self.c_text_muted, activebackground="#45475a", activeforeground="#ffffff",
            relief="flat", padx=12, pady=6, cursor="hand2", command=self.reset_metrics_action
        )
        btn_reset.pack(side="left")
        
        btn_clear_log = tk.Button(
            ctrl_frame, text="Limpar Log", font=("Segoe UI", 8),
            bg=self.c_bg, fg=self.c_text_muted, activebackground="#313244", activeforeground="#ffffff",
            relief="flat", cursor="hand2", command=self.clear_log
        )
        btn_clear_log.pack(side="right")

        # 4. Histórico de Eventos / Log em Tempo Real
        log_container = tk.Frame(self, bg=self.c_bg, padx=20, pady=(0, 15))
        log_container.pack(fill="both", expand=True)
        
        tk.Label(
            log_container, text="Registro de Atividades em Tempo Real:",
            font=("Segoe UI", 9, "bold"), fg=self.c_text_muted, bg=self.c_bg
        ).pack(anchor="w", pady=(0, 5))
        
        self.log_text = ScrolledText(
            log_container, bg="#11111b", fg=self.c_text, insertbackground="#ffffff",
            font=("Consolas", 9), relief="flat", padx=10, pady=10, height=10
        )
        self.log_text.pack(fill="both", expand=True)
        
        # Tags de cores para o log
        self.log_text.tag_config("time", foreground="#6c7086")
        self.log_text.tag_config("ok", foreground=self.c_green)
        self.log_text.tag_config("fail", foreground=self.c_red)
        self.log_text.tag_config("switch", foreground=self.c_accent, font=("Consolas", 9, "bold"))
        self.log_text.tag_config("warn", foreground=self.c_yellow)
        self.log_text.tag_config("info", foreground=self.c_text)

    def append_log(self, text, tag="info"):
        now_str = time.strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{now_str}] ", "time")
        self.log_text.insert("end", f"{text}\n", tag)
        self.log_text.see("end")

    def clear_log(self):
        self.log_text.delete("1.0", "end")

    def toggle_monitoring(self):
        if self.is_monitoring.is_set():
            self.is_monitoring.clear()
            self.btn_pause.config(text="▶ Iniciar Monitoramento", bg="#2a3d2e", fg=self.c_green)
            self.badge_status.config(text="■ MONITORAMENTO PAUSADO", fg=self.c_text_muted, bg="#2a2a3c")
            self.append_log("Monitoramento pausado pelo usuário.", "warn")
        else:
            self.is_monitoring.set()
            self.btn_pause.config(text="⏸ Pausar Monitoramento", bg="#313244", fg=self.c_text)
            self.append_log("Monitoramento retomado.", "info")

    def reset_metrics_action(self):
        if self.primary_info:
            reset_interface_metric(self.primary_info["ifIndex"])
        if self.secondary_info:
            reset_interface_metric(self.secondary_info["ifIndex"])
        flush_dns()
        self.append_log("Métricas do Windows restauradas para o modo automático.", "warn")
        messagebox.showinfo("NetFailover", "Métricas restauradas para o padrão do Windows com sucesso!")

    def force_manual_switch(self):
        if not self.secondary_info or self.secondary_info["ConnectionState"] != 1:
            messagebox.showwarning(
                "Celular Não Conectado",
                "Para testar o failover, conecte o celular primeiro (via Ancoragem USB ou Wi-Fi)."
            )
            return
        
        if self.current_mode == "NORMAL":
            set_interface_metric(self.primary_info["ifIndex"], self.cfg["primary_inactive_metric"])
            set_interface_metric(self.secondary_info["ifIndex"], self.cfg["secondary_active_metric"])
            flush_dns()
            self.current_mode = "FAILOVER"
            self.btn_switch_test.config(text="⚡ Voltar para o Cabo")
            self.append_log("⚡ Teste: Chaveado manualmente para o Celular 5G!", "switch")
        else:
            set_interface_metric(self.primary_info["ifIndex"], self.cfg["primary_active_metric"])
            set_interface_metric(self.secondary_info["ifIndex"], self.cfg["secondary_standby_metric"])
            flush_dns()
            self.current_mode = "NORMAL"
            self.btn_switch_test.config(text="⚡ Testar Failover Manual")
            self.append_log("⚡ Teste: Retornado manualmente para o Cabo de Rede!", "switch")

    def start_worker_thread(self):
        self.monitor_thread = threading.Thread(target=self.worker_loop, daemon=True)
        self.monitor_thread.start()

    def worker_loop(self):
        self.update_queue.put(("log", ("Iniciando NetFailover Engine...", "info")))
        
        fail_count = 0
        recovery_count = 0
        metrics_initialized = False

        while not self.stop_event.is_set():
            if not self.is_monitoring.is_set():
                time.sleep(0.5)
                continue

            interfaces = get_network_interfaces()
            
            # 1. Identificar primária (Cabo)
            primary_match = self.cfg.get("primary_interface", "Ethernet").lower()
            found_primary = None
            for iface in interfaces:
                if primary_match in iface["InterfaceAlias"].lower():
                    found_primary = iface
                    break
            
            if not found_primary:
                self.update_queue.put(("log", (f"Interface '{self.cfg.get('primary_interface')}' não localizada.", "fail")))
                time.sleep(3)
                continue
            
            self.primary_info = found_primary

            # 2. Identificar secundária (Celular)
            secondary_match = self.cfg.get("secondary_interface", "").strip().lower()
            found_secondary = None
            for iface in interfaces:
                if iface["ifIndex"] == self.primary_info["ifIndex"] or iface["ifIndex"] == 1:
                    continue
                if secondary_match and secondary_match in iface["InterfaceAlias"].lower():
                    if iface["ConnectionState"] == 1 and iface["IPAddress"] and not iface["IPAddress"].startswith("169.254."):
                        found_secondary = iface
                        break
                elif not secondary_match:
                    if iface["ConnectionState"] == 1 and iface["IPAddress"] and not iface["IPAddress"].startswith("169.254."):
                        found_secondary = iface
                        break

            self.secondary_info = found_secondary

            # 3. Teste do Cabo
            prim_ok, prim_lat = probe_adapter(
                self.primary_info["IPAddress"],
                self.cfg["test_targets"],
                timeout=self.cfg["socket_timeout_seconds"]
            )

            # 4. Teste do Celular
            sec_ok, sec_lat = (False, None)
            if self.secondary_info:
                sec_ok, sec_lat = probe_adapter(
                    self.secondary_info["IPAddress"],
                    self.cfg["test_targets"],
                    timeout=self.cfg["socket_timeout_seconds"]
                )

            # Inicializar métricas padrão
            if not metrics_initialized and self.current_mode == "NORMAL":
                set_interface_metric(self.primary_info["ifIndex"], self.cfg["primary_active_metric"])
                if self.secondary_info:
                    set_interface_metric(self.secondary_info["ifIndex"], self.cfg["secondary_standby_metric"])
                metrics_initialized = True
                self.update_queue.put(("log", ("Métricas de rota configuradas: Cabo Prioritário (10) | Celular Standby (50)", "ok")))

            # 5. Máquina de Estados
            log_event = None
            if self.current_mode == "NORMAL":
                if prim_ok:
                    fail_count = 0
                else:
                    fail_count += 1
                    log_event = (f"Alerta: Cabo sem resposta ({fail_count}/{self.cfg['fail_threshold']})", "warn")
                    
                    if fail_count >= self.cfg["fail_threshold"]:
                        if self.secondary_info and sec_ok:
                            set_interface_metric(self.primary_info["ifIndex"], self.cfg["primary_inactive_metric"])
                            set_interface_metric(self.secondary_info["ifIndex"], self.cfg["secondary_active_metric"])
                            flush_dns()
                            self.current_mode = "FAILOVER"
                            recovery_count = 0
                            log_event = (f"🚨 INTERNET DO CABO CAIU! Tráfego transferido para: {self.secondary_info['InterfaceAlias']} (5G)", "switch")
                        elif self.secondary_info and not sec_ok:
                            log_event = ("Cabo falhou, mas celular também não responde!", "fail")
                        else:
                            log_event = ("Cabo falhou, mas celular ainda não foi conectado!", "fail")

            elif self.current_mode == "FAILOVER":
                if prim_ok:
                    recovery_count += 1
                    log_event = (f"Cabo respondeu ({prim_lat}ms) - Validando estabilidade ({recovery_count}/{self.cfg['recovery_threshold']})", "info")
                    
                    if recovery_count >= self.cfg["recovery_threshold"]:
                        set_interface_metric(self.primary_info["ifIndex"], self.cfg["primary_active_metric"])
                        if self.secondary_info:
                            set_interface_metric(self.secondary_info["ifIndex"], self.cfg["secondary_standby_metric"])
                        flush_dns()
                        self.current_mode = "NORMAL"
                        fail_count = 0
                        log_event = (f"✅ CABO VOLTOU E ESTABILIZOU! Prioridade restabelecida no Cabo.", "ok")
                else:
                    recovery_count = 0

            # Enviar dados completos para a UI atualizar
            state_data = {
                "prim_info": self.primary_info,
                "prim_ok": prim_ok,
                "prim_lat": prim_lat,
                "sec_info": self.secondary_info,
                "sec_ok": sec_ok,
                "sec_lat": sec_lat,
                "mode": self.current_mode,
                "log_event": log_event
            }
            self.update_queue.put(("state", state_data))

            time.sleep(self.cfg["check_interval_seconds"])

    def process_queue(self):
        try:
            while True:
                msg_type, data = self.update_queue.get_nowait()
                if msg_type == "log":
                    text, tag = data
                    self.append_log(text, tag)
                elif msg_type == "state":
                    self.update_display(data)
        except queue.Empty:
            pass
        finally:
            self.after(100, self.process_queue)

    def update_display(self, d):
        prim = d["prim_info"]
        sec = d["sec_info"]
        mode = d["mode"]
        
        # 1. Atualizar Badge Geral
        if mode == "NORMAL":
            self.badge_status.config(
                text="● MODO NORMAL (Cabo Ativo)", fg=self.c_green, bg=self.c_green_bg
            )
        else:
            self.badge_status.config(
                text="🚨 FAILOVER ATIVO (Celular 5G)", fg=self.c_red, bg=self.c_red_bg
            )

        # 2. Atualizar Card do Cabo
        if prim:
            self.lbl_cable_ip.config(text=f"IP: {prim['IPAddress']} ({prim['InterfaceAlias']})")
            if d["prim_ok"]:
                self.lbl_cable_status.config(
                    text=f"ONLINE ({d['prim_lat']} ms)", fg=self.c_green, bg=self.c_green_bg
                )
                self.lbl_cable_lat.config(text=f"Latência: {d['prim_lat']} ms (Excelente)")
            else:
                self.lbl_cable_status.config(
                    text="SEM RESPOSTA / QUEDA", fg=self.c_red, bg=self.c_red_bg
                )
                self.lbl_cable_lat.config(text="Latência: Esgotada (Offline)")

            if mode == "NORMAL":
                self.lbl_cable_metric.config(text="Prioridade: Métrica 10 (Principal)")
            else:
                self.lbl_cable_metric.config(text="Prioridade: Métrica 9999 (Rebaixada)")

        # 3. Atualizar Card do Celular
        if sec and sec["ConnectionState"] == 1:
            self.lbl_cell_ip.config(text=f"IP: {sec['IPAddress']} ({sec['InterfaceAlias']})")
            if d["sec_ok"]:
                if mode == "FAILOVER":
                    self.lbl_cell_status.config(
                        text=f"ATIVO NO MOMENTO ({d['sec_lat']} ms)", fg=self.c_green, bg=self.c_green_bg
                    )
                    self.lbl_cell_metric.config(text="Prioridade: Métrica 10 (Assumiu Tráfego)")
                else:
                    self.lbl_cell_status.config(
                        text=f"STANDBY PRONTO ({d['sec_lat']} ms)", fg=self.c_yellow, bg=self.c_yellow_bg
                    )
                    self.lbl_cell_metric.config(text="Prioridade: Métrica 50 (Standby)")
                self.lbl_cell_lat.config(text=f"Latência: {d['sec_lat']} ms")
            else:
                self.lbl_cell_status.config(
                    text="CONECTADO (Sem Internet)", fg=self.c_red, bg=self.c_red_bg
                )
                self.lbl_cell_lat.config(text="Latência: Timeout")
        else:
            self.lbl_cell_status.config(
                text="Aguardando conexão USB/Wi-Fi", fg=self.c_text_muted, bg="#2a2a3c"
            )
            self.lbl_cell_ip.config(text="IP: Desconectado")
            self.lbl_cell_lat.config(text="Latência: --")
            self.lbl_cell_metric.config(text="Prioridade: --")

        # 4. Registrar logs se houver evento
        if d.get("log_event"):
            text, tag = d["log_event"]
            self.append_log(text, tag)

    def on_closing(self):
        self.stop_event.set()
        if self.primary_info:
            reset_interface_metric(self.primary_info["ifIndex"])
        if self.secondary_info:
            reset_interface_metric(self.secondary_info["ifIndex"])
        flush_dns()
        self.destroy()


def main():
    elevate_privileges()
    app = NetFailoverApp()
    app.mainloop()

if __name__ == "__main__":
    main()
