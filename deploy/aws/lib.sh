NAME=GrowthOS
DOMAIN_NAME=growthos
export AWS_DEFAULT_REGION=${AWS_REGION:-ap-south-1}
REGION=$AWS_DEFAULT_REGION
iid() {
  aws ec2 describe-instances --filters "Name=tag:Name,Values=$NAME" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
    --query 'Reservations[].Instances[].InstanceId' --output text
}
ip() { aws ec2 describe-instances --instance-ids "$1" --query 'Reservations[].Instances[].PublicIpAddress' --output text; }
state() { aws ec2 describe-instances --instance-ids "$1" --query 'Reservations[0].Instances[0].State.Name' --output text; }
site() { echo "https://$DOMAIN_NAME.duckdns.org"; }
bucket() { echo "growthos-deploy-$(aws sts get-caller-identity --query Account --output text)"; }
upload_release() {
  local tmp; tmp=$(mktemp -d)
  tar czf "$tmp/growthos.tgz" -C "$(dirname "$0")/../.." \
    --exclude=node_modules --exclude=dist --exclude=.git --exclude='.env' --exclude='.env.*' \
    --exclude=generated --exclude=generated-data --exclude=frontend --exclude=docs --exclude=.next \
    backend channel-service packages deploy
  aws s3 cp "$tmp/growthos.tgz" "s3://$(bucket)/growthos.tgz" --only-show-errors
  rm -rf "$tmp"
}
