"""Penjaga URL target (anti-SSRF) untuk semua konektor yang menerima URL pengguna.
Aturan (spek Dataset Studio §6D):
- skema hanya http/https
- tolak host internal: loopback, privat (RFC1918), link-local, multicast,
  reserved, serta IP metadata cloud 169.254.169.254
- resolusi DNS lalu periksa ULANG semua A/AAAA (cegah DNS-rebinding dasar)
- panjang URL dibatasi; kredensial userinfo (user:pass@host) ditolak
Validasi string saja tidak cukup untuk egress penuh (butuh firewall worker),
tapi ini menghentikan SSRF sepele via form.
"""
from __future__ import annotations
import ipaddress
import socket
from urllib.parse import urlparse

MAX_URL_LEN = 2000
METADATA_IPS = {"169.254.169.254", "fd00:ec2::254"}


def _bad_ip(ip: ipaddress._BaseAddress) -> str | None:
    if ip.is_loopback:
        return "loopback"
    if ip.is_link_local:
        return "link-local"
    if ip.is_multicast:
        return "multicast"
    if ip.is_reserved:
        return "reserved"
    if ip.is_private:
        return "privat/internal"
    if str(ip) in METADATA_IPS or (isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped and str(ip.ipv4_mapped) in METADATA_IPS):
        return "metadata cloud"
    return None


def guard_url(url: str, label: str = "URL") -> str:
    """Validasi URL target. Kembalikan URL bersih atau raise ValueError."""
    s = (url or "").strip()
    if not s:
        raise ValueError(f"{label} wajib diisi.")
    if len(s) > MAX_URL_LEN:
        raise ValueError(f"{label} terlalu panjang (maks {MAX_URL_LEN} karakter).")
    try:
        p = urlparse(s)
    except Exception as e:
        raise ValueError(f"{label} tidak valid: {e}") from e
    if p.scheme not in ("http", "https"):
        raise ValueError(f"{label} harus diawali http:// atau https://.")
    if p.username or p.password:
        raise ValueError(f"{label} tidak boleh mengandung kredensial (user:pass@).")
    host = (p.hostname or "").strip().rstrip(".")
    if not host:
        raise ValueError(f"{label} tidak memiliki host.")
    # Host literal IP → cek langsung.
    try:
        reason = _bad_ip(ipaddress.ip_address(host))
        if reason:
            raise ValueError(f"{label} menunjuk alamat {reason} ({host}) — ditolak demi keamanan.")
        return s
    except ValueError as e:
        if "ditolak demi keamanan" in str(e):
            raise
    # Hostname → resolusi DNS, cek SEMUA hasil (defense-in-depth vs rebinding).
    try:
        infos = socket.getaddrinfo(host, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise ValueError(f"{label}: host '{host}' tidak dapat diresolusi.") from e
    seen: set[str] = set()
    for fam, _, _, _, sockaddr in infos:
        ip_str = sockaddr[0]
        if ip_str in seen:
            continue
        seen.add(ip_str)
        try:
            reason = _bad_ip(ipaddress.ip_address(ip_str))
        except ValueError:
            continue
        if reason:
            raise ValueError(f"{label}: '{host}' teresolusi ke alamat {reason} ({ip_str}) — ditolak.")
    if not seen:
        raise ValueError(f"{label}: host '{host}' tidak memiliki alamat IP.")
    return s
