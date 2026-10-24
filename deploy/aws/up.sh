#!/usr/bin/env bash
# Create the GrowthOS EC2 instance (one time). Reads keys from backend/.env.
#   deploy/aws/up.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
. deploy/aws/lib.sh
INSTANCE_TYPE=${INSTANCE_TYPE:-t3.medium}
BUCKET=$(bucket)

[ -z "$(iid)" ] || { echo "instance already exists: $(iid)"; exit 1; }
[ -f backend/.env ] || { echo "no backend/.env"; exit 1; }
pick() { grep -E "^$1=" backend/.env | head -1 | cut -d= -f2- || true; }
rand() { openssl rand -base64 32 | tr -d '\n'; }

if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi
upload_release

{
  echo "DOMAIN=$DOMAIN_NAME.duckdns.org"
  echo "FRONTEND_URL=$(pick FRONTEND_URL)"
  for k in DATABASE_URL DIRECT_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_JWT_SECRET OPENROUTER_API_KEY \
    INTEGRATION_MASTER_KEY SENTRY_DSN ALERT_WEBHOOK_URL OPENROUTER_MIN_CREDITS_USD STRIPE_SECRET_KEY STRIPE_PRICE_ID \
    STRIPE_WEBHOOK_SECRET RESEND_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_NUMBER; do
    v=$(pick $k); [ -z "$v" ] || echo "$k=$v"
  done
  # Both services must share this value. Reuse the one in backend/.env when it exists.
  echo "WEBHOOK_SECRET=$(pick WEBHOOK_SECRET | grep . || rand)"
  echo "INTERNAL_API_SECRET=$(pick INTERNAL_API_SECRET | grep . || rand)"
} > /tmp/growthos.env
aws ssm put-parameter --name /growthos/env --type SecureString --overwrite --value file:///tmp/growthos.env >/dev/null
rm -f /tmp/growthos.env

if ! aws iam get-role --role-name growthos >/dev/null 2>&1; then
  aws iam create-role --role-name growthos --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name growthos --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  aws iam put-role-policy --role-name growthos --policy-name deploy-read --policy-document \
    "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"ssm:GetParameter\",\"kms:Decrypt\"],\"Resource\":\"*\"},{\"Effect\":\"Allow\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/*\"}]}"
  aws iam create-instance-profile --instance-profile-name growthos >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name growthos --role-name growthos
  sleep 12
fi

VPC=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=growthos Name=vpc-id,Values="$VPC" --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = "None" ]; then
  SG=$(aws ec2 create-security-group --group-name growthos --description GrowthOS --vpc-id "$VPC" --query GroupId --output text)
  for p in 80 443; do aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port $p --cidr 0.0.0.0/0 >/dev/null; done
fi

AMI=$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
sed -e "s|__REGION__|$REGION|g" -e "s|__BUCKET__|$BUCKET|g" -e "s|__DOMAIN_NAME__|$DOMAIN_NAME|g" deploy/aws/user-data.sh > /tmp/growthos-user-data.sh

# Portfolio=true and HealthUrl make `awsstart`, `awsstop` and `awsstatus` pick this server up.
ID=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$INSTANCE_TYPE" --security-group-ids "$SG" \
  --iam-instance-profile Name=growthos --user-data file:///tmp/growthos-user-data.sh \
  --metadata-options HttpTokens=required \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3,DeleteOnTermination=true}' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Portfolio,Value=true},{Key=HealthUrl,Value=$(site)/api/health}]" \
  --query 'Instances[0].InstanceId' --output text)
rm -f /tmp/growthos-user-data.sh
echo "created $ID. First boot builds everything (~10 min). Watch: deploy/aws/status.sh"
echo "Next: add $ID to the stop-at-50-usd budget action, and apply any pending database migrations (DEPLOYMENT.md)."
