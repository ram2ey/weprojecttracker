# Run on a separate Docker builder. Never supply application secrets to builds.
# docker buildx bake -f docker-bake.hcl builds both Linux targets locally.
# Set WEB_IMAGE / TOOLS_IMAGE to release tags before using --push.
variable "WEB_IMAGE" {
  default = "wassa-web:local"
}
variable "TOOLS_IMAGE" {
  default = "wassa-tools:local"
}
variable "TARGET_PLATFORM" {
  default = "linux/amd64"
}
group "default" {
  targets = ["web", "tools"]
}
target "common" {
  context = "."
  dockerfile = "Dockerfile"
  platforms = [TARGET_PLATFORM]
}
target "web" {
  inherits = ["common"]
  target = "web"
  tags = [WEB_IMAGE]
}
target "tools" {
  inherits = ["common"]
  target = "tools"
  tags = [TOOLS_IMAGE]
}
