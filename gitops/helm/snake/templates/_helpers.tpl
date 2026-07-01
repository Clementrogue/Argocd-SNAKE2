{{- define "snake.labels" -}}
app: snake
app.kubernetes.io/name: snake
app.kubernetes.io/part-of: argocd-snake
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "snake.selectorLabels" -}}
app: snake
{{- end -}}
