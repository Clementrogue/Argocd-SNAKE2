terraform {
  required_version = ">= 1.5"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23"
    }
  }
}

# Le TF Controller injecte le provider (in-cluster). Pas de config manuelle.
provider "kubernetes" {}

variable "environments" {
  type    = list(string)
  default = ["snake-dev", "snake-prod"]
}

# Namespaces applicatifs gérés en IaC
resource "kubernetes_namespace" "snake" {
  for_each = toset(var.environments)
  metadata {
    name = each.value
    labels = {
      "app.kubernetes.io/part-of" = "argocd-snake"
      "managed-by"                = "terraform-controller"
    }
  }
}

# RBAC : rôle en lecture seule sur les pods de chaque namespace
resource "kubernetes_role" "snake_viewer" {
  for_each = kubernetes_namespace.snake
  metadata {
    name      = "snake-viewer"
    namespace = each.value.metadata[0].name
  }
  rule {
    api_groups = [""]
    resources  = ["pods", "services", "endpoints"]
    verbs      = ["get", "list", "watch"]
  }
}

# Network Policy : on n'autorise que le trafic entrant vers le port 3000
resource "kubernetes_network_policy" "snake" {
  for_each = kubernetes_namespace.snake
  metadata {
    name      = "snake-allow-http"
    namespace = each.value.metadata[0].name
  }
  spec {
    pod_selector {
      match_labels = { app = "snake" }
    }
    ingress {
      ports {
        port     = 3000
        protocol = "TCP"
      }
    }
    policy_types = ["Ingress"]
  }
}

output "namespaces" {
  value = [for ns in kubernetes_namespace.snake : ns.metadata[0].name]
}

import {
  to = kubernetes_namespace.snake["snake-dev"]
  id = "snake-dev"
}

import {
  to = kubernetes_namespace.snake["snake-prod"]
  id = "snake-prod"
}
