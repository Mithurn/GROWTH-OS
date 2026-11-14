#!/usr/bin/env bash
# One time: let GitHub Actions on main ship code to the server, with no stored AWS keys.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
REPO=Mithurn/GROWTH-OS
ROLE=growthos-github-deploy
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
OIDC=arn:aws:iam::$ACCOUNT:oidc-provider/token.actions.githubusercontent.com

aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC" >/dev/null 2>&1 ||
  aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null

TRUST="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Federated\":\"$OIDC\"},\"Action\":\"sts:AssumeRoleWithWebIdentity\",\"Condition\":{\"StringEquals\":{\"token.actions.githubusercontent.com:aud\":\"sts.amazonaws.com\"},\"StringLike\":{\"token.actions.githubusercontent.com:sub\":\"repo:Mithurn*/GROWTH-OS*:ref:refs/heads/main\"}}}]}"
if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$ROLE" --policy-document "$TRUST"
else
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document "$TRUST" >/dev/null
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name deploy --policy-document \
  "{\"Version\":\"2012-10-17\",\"Statement\":[
   {\"Effect\":\"Allow\",\"Action\":[\"ec2:DescribeInstances\",\"sts:GetCallerIdentity\"],\"Resource\":\"*\"},
   {\"Effect\":\"Allow\",\"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$(bucket)/*\"},
   {\"Effect\":\"Allow\",\"Action\":\"ssm:SendCommand\",\"Resource\":[\"arn:aws:ssm:$REGION::document/AWS-RunShellScript\",\"arn:aws:ec2:$REGION:$ACCOUNT:instance/*\"]}]}"
gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" --body "arn:aws:iam::$ACCOUNT:role/$ROLE"
echo "role ready: $ROLE"
