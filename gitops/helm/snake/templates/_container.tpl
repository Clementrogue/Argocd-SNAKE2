{{- define "snake.container" -}}
- name: snake
  image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
  imagePullPolicy: {{ .Values.image.pullPolicy }}
  ports:
    - containerPort: {{ .Values.service.targetPort }}
  env:
    - name: APP_VERSION
      value: "{{ .Values.app.version }}"
    - name: APP_COLOR
      value: "{{ .Values.app.color }}"
  resources:
{{ toYaml .Values.resources | indent 4 }}
  livenessProbe:
    httpGet:
      path: /healthz
      port: {{ .Values.service.targetPort }}
    initialDelaySeconds: 5
    periodSeconds: 10
  readinessProbe:
    httpGet:
      path: /readyz
      port: {{ .Values.service.targetPort }}
    initialDelaySeconds: 3
    periodSeconds: 5
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]
{{- end -}}
