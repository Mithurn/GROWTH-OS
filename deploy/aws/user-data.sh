#!/bin/bash
set -euxo pipefail
exec > /var/log/growthos-init.log 2>&1
export HOME=/root
cat > /etc/growthos.conf <<'C'
REGION=__REGION__
BUCKET=__BUCKET__
DOMAIN_NAME=__DOMAIN_NAME__
C

fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
apt-get update -y && apt-get install -y curl
snap install aws-cli --classic
curl -fsSL https://get.docker.com | sh

/snap/bin/aws s3 cp "s3://__BUCKET__/growthos.tgz" /tmp/growthos.tgz --region __REGION__
mkdir -p /opt/growthos && tar xzf /tmp/growthos.tgz -C /opt/growthos
install -m 755 /opt/growthos/deploy/aws/boot.sh /usr/local/bin/growthos-boot.sh
install -m 755 /opt/growthos/deploy/aws/release.sh /usr/local/bin/growthos-release.sh

cat > /etc/systemd/system/growthos-boot.service <<'U'
[Unit]
Description=GrowthOS DNS update and stack start
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/growthos-boot.sh

[Install]
WantedBy=multi-user.target
U
systemctl daemon-reload
systemctl enable growthos-boot.service

/usr/local/bin/growthos-release.sh
echo GROWTHOS_READY
