export default function getRedisConfig(port: string, name: string, password: string): string {
    return `
bind 0.0.0.0
protected-mode yes
port ${port}
tcp-backlog 511
timeout 0
tcp-keepalive 300
daemonize yes
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/${name}.log
databases 16
always-show-logo yes
set-proc-title yes
proc-title-template "{title} ${port}"
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
rdb-del-sync-files no
dir /var/lib/${name}
replica-serve-stale-data yes
replica-read-only yes
repl-diskless-sync yes
repl-diskless-sync-delay 5
repl-diskless-load disabled
appendonly no
appendfilename "appendonly.aof"
appenddirname "appendonlydir"
user default on >${password} ~* +@all
    `.trim();
}
