#!/bin/sh
set -e

# 启动保险：容器以 root 启动时，先把数据目录归还给运行用户 appuser，再降权运行。
# 目的是规避"宿主侧直接改动/拷贝 db 文件（会带上宿主 uid）导致服务进程只读、
# 报 attempt to write a readonly database 而崩溃重启"的问题——重启即自愈。
if [ "$(id -u)" = "0" ]; then
    chown -R appuser:appuser /app/data 2>/dev/null || true
    exec gosu appuser "$@"
fi

# 非 root（已是 appuser）时直接运行
exec "$@"
