# Fase 3 — Piattaforma: ArgoCD, KSOPS, cloudflared + Traefik — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (riga "Fase 3" della tabella Fasi)

**Obiettivo:** portare il cluster (k3s, dalla Fase 2) al punto in cui un'app arbitraria può essere dichiarata in Git e ArgoCD la porta online, raggiungibile da internet solo tramite Cloudflare Tunnel, senza mai una porta pubblica aperta e senza mai un segreto in chiaro nel repo.

**Criterio di completamento (dalla spec):** *"una app di prova risponde su un sottodominio via tunnel, gestita da ArgoCD"*.

**Stato di partenza** (dalla Fase 2): k3s `Ready`, senza Traefik/servicelb, raggiungibile solo via Tailscale; repo `buddy-budget-infra` con `ansible/`. Nessuno strumento tra `helm`/`sops`/`cloudflared` è ancora installato in WSL.

## Decisioni prese per questa fase (non ancora nella spec a questo livello di dettaglio)

- **ArgoCD**: installato una tantum con i manifest ufficiali (`kubectl apply`), non gestito da se stesso. Da qui in poi tutto il resto (Traefik, cloudflared, KSOPS, l'app di prova, e in Fase 4+ CNPG/Redis/observability) passa da un'unica **App-of-Apps**: un'`Application` ArgoCD che punta a `buddy-budget-infra/argocd/apps/`, dove ogni file YAML in quella cartella è a sua volta un'altra `Application`. Aggiungere un componente futuro = aggiungere un file, mai un comando manuale.
- **KSOPS**: la chiave privata age (generata in Fase 1, mai in git) va **dentro il cluster una tantum, fuori da GitOps** (`kubectl create secret`) — è l'unico segreto "radice" dell'intero sistema, coerente con la spec ("l'unica chiave age da custodire"). Tutto il resto (incluse le credenziali di `cloudflared`, create in questa stessa fase) viene cifrato con la sola **chiave pubblica** e committato, decifrato automaticamente da ArgoCD via il plugin KSOPS montato nel `repo-server`.
- **cloudflared**: creo il tunnel con la CLI `cloudflared` (non dal pannello Cloudflare), stesso schema già usato per Tailscale — un login one-time che apri tu nel browser, autorizza la CLI ad agire sul tuo account Cloudflare per creare il tunnel. Il file di credenziali che ne esce è un segreto vero: lo cifro subito con SOPS prima che tocchi il repo, mai in chiaro.
- **cloudflared → Traefik → app**: `cloudflared` (pod nel cluster) inoltra il traffico del tunnel alla `Service` ClusterIP di Traefik (mai una porta pubblica sull'host); Traefik instrada per hostname alle app tramite `IngressRoute` — aggiungere un sottodominio futuro è una risorsa Kubernetes, non una riconfigurazione del tunnel.
- **Namespace di questa fase**: `argocd`, `ingress` (Traefik + cloudflared), `demo` (per la sola verifica finale, la elimineremo prima della Fase 4). NetworkPolicy default-deny + eccezioni esplicite su ciascuno.

## Chi esegue cosa

Come nelle fasi precedenti: la maggior parte dei comandi li eseguo io (accesso già disponibile via Tailscale/kubectl). Ti chiedo conferma esplicita prima di:
- creare il segreto della chiave age nel cluster (root di fiducia di tutto il resto);
- il login `cloudflared` (apri tu un URL nel browser, come per Tailscale).

## Ordine dei passi

1. Strumenti in WSL: `helm`, `sops`, `cloudflared`.
2. ArgoCD installato (manifest ufficiali), accesso UI verificato via Tailscale.
3. **[conferma]** Bootstrap KSOPS: segreto age nel cluster + plugin nel `repo-server`, verificato con un file di prova cifrato/decifrato.
4. App-of-Apps: un'`Application` ArgoCD che punta a `argocd/apps/` nel repo infra.
5. Traefik via Helm chart, esposto solo come `ClusterIP` (nessuna porta host).
6. **[conferma]** Tunnel Cloudflare: login CLI, creazione tunnel, DNS, credenziali cifrate con SOPS e committate; `cloudflared` deploy nel cluster.
7. NetworkPolicy default-deny per `argocd`/`ingress`/`demo` + `ResourceQuota`/`LimitRange`.
8. App di prova (`whoami` o `nginx` minimale) dichiarata in Git, sincronizzata da ArgoCD, raggiungibile su `test.buddybudget.io` dall'esterno — verifica reale con `curl` da qui, non da dentro la tailnet.
9. Pulizia: namespace `demo` rimosso (era solo per la verifica).

---

### Passo 1 — Strumenti in WSL

Installo `helm` (script ufficiale), `sops` (release GitHub), `cloudflared` (repo APT ufficiale Cloudflare). `kubectl` è già disponibile su Windows (Fase 2); in WSL ne aggiungo una copia puntata allo stesso `~/.kube/buddybudget-config`.

**Verifica:** `helm version`, `sops --version`, `cloudflared --version` rispondono.

---

### Passo 2 — ArgoCD

Namespace `argocd`, manifest ufficiali (`install.yaml` canale stable) applicati con `kubectl apply -n argocd -f ...`. Recupero la password iniziale dell'utente `admin` (generata da ArgoCD stesso, non da me) e la giro a te via un comando che stampi, non tramite chat, per cambiarla subito.

**Verifica:** `kubectl get pods -n argocd` tutti `Running`; accesso alla UI via `kubectl port-forward` attraverso Tailscale (non esposta pubblicamente qui — l'esporremo dietro Traefik/tunnel più avanti, se vorrai, con autenticazione propria).

---

### Passo 3 — Bootstrap KSOPS ⚠️ conferma richiesta

Prima di eseguire: **confermi che la chiave privata age è ancora quella di Fase 1**, salvata nel tuo password manager? Non mi serve rivederla, solo la conferma che esiste e la sai recuperare se il segreto k8s andasse perso (in quel caso lo si ricrea dalla stessa chiave, zero perdita).

Eseguo:
- `kubectl create secret generic sops-age -n argocd --from-file=key.txt=<percorso locale>` (il contenuto non transita mai per la chat, lo leggo da file);
- ricostruisco l'immagine del `repo-server` di ArgoCD con `ksops`/`sops` installati (o monto un init-container ufficiale `viaduct-ai/ksops`, a seconda di cosa si integra meglio con la versione ArgoCD installata — decido in corsa, lo annoto);
- configuro `argocd-cm` per abilitare Kustomize con plugin ksops, e monto il segreto `sops-age` nel `repo-server` come `SOPS_AGE_KEY_FILE`.

**Verifica:** cifro un file di prova con `sops -e --age <chiave-pubblica>`, lo metto in una `Application` ArgoCD di test, e verifico che ArgoCD lo decifri e crei il `Secret` k8s corrispondente — poi cancello sia il file di prova che il segreto risultante.

---

### Passo 4 — App-of-Apps

Struttura nel repo infra:
```
argocd/
  root-app.yaml        # Application che punta a argocd/apps/
  apps/
    traefik.yaml        # Application → argocd/manifests/traefik/
    cloudflared.yaml     # Application → argocd/manifests/cloudflared/
    demo.yaml            # Application → argocd/manifests/demo/ (rimossa al Passo 9)
  manifests/
    traefik/
    cloudflared/
    demo/
```
`kubectl apply -f argocd/root-app.yaml` una tantum; da lì ArgoCD legge tutto il resto da solo.

**Verifica:** la UI di ArgoCD (via port-forward) mostra l'app `root` e le sue app figlie, anche se ancora vuote/non sincronizzate (i manifest arrivano nei passi successivi).

---

### Passo 5 — Traefik

`argocd/manifests/traefik/` con un `Application` che referenzia il chart Helm ufficiale `traefik/traefik`, `values.yaml` con `service.type: ClusterIP` (esplicito, per non lasciare che il default apra qualcosa sull'host) e dashboard disattivata pubblicamente per ora.

**Verifica:** ArgoCD sincronizza, `kubectl get pods -n ingress` mostra Traefik `Running`; nessuna nuova porta in ascolto sull'host (ricontrollo con lo stesso scan usato in Fase 2).

---

### Passo 6 — Tunnel Cloudflare ⚠️ conferma richiesta

Da WSL: `cloudflared tunnel login` stampa un URL — te lo giro, lo apri loggato su Cloudflare, autorizzi. Poi:
- `cloudflared tunnel create buddybudget-vps` → genera `<tunnel-id>` e un file di credenziali (**segreto vero**, contiene un token);
- `cloudflared tunnel route dns buddybudget-vps test.buddybudget.io` → crea il CNAME su Cloudflare, niente da fare a mano nel pannello;
- cifro **subito** il file di credenziali con `sops -e --age <chiave-pubblica-age>` e lo salvo in `argocd/manifests/cloudflared/credentials.enc.yaml` — il file in chiaro non tocca mai il repo, lo elimino dal disco locale appena cifrato;
- manifest `cloudflared` (Deployment + ConfigMap con `ingress: - hostname: test.buddybudget.io service: http://traefik.ingress.svc.cluster.local:80`), gestito dall'App-of-Apps.

**Prima di lanciare `cloudflared tunnel login` ti chiedo conferma**, visto che è un'azione che tocca il tuo account Cloudflare (crea un tunnel, un CNAME). Reversibile in ogni momento (si cancella il tunnel da CLI o pannello).

**Verifica:** `cloudflared tunnel list` mostra `buddybudget-vps`; il DNS `test.buddybudget.io` risolve a `<tunnel-id>.cfargotunnel.com` (verificabile con `dig`/`nslookup`, nessun segreto coinvolto).

---

### Passo 7 — NetworkPolicy + quote risorse

Per `argocd`, `ingress`, `demo`: `NetworkPolicy` default-deny in ingresso con eccezioni esplicite (es. `ingress` → `argocd` per il futuro accesso alla UI, `ingress` → `demo` per il traffico di Traefik verso l'app di prova). `ResourceQuota`/`LimitRange` per namespace, valori conservativi vista la RAM totale (8GB).

**Verifica:** un pod di test in un namespace senza regole esplicite non riesce a raggiungere un altro namespace (`kubectl exec ... -- curl` fallisce come previsto).

---

### Passo 8 — App di prova end-to-end

`argocd/manifests/demo/`: Deployment `traefik/whoami` (immagine minimale, risponde con informazioni sulla richiesta — utile per debug) + `Service` + `IngressRoute` per `test.buddybudget.io`.

**Verifica, la più importante di questa fase:** `curl https://test.buddybudget.io` **da qui** (rete esterna, non tailnet) restituisce la risposta di `whoami` — prova che l'intera catena Cloudflare → tunnel → Traefik → pod funziona, gestita end-to-end da ArgoCD (nessun `kubectl apply` manuale sull'app stessa, solo `git push`).

---

### Passo 9 — Pulizia

Rimuovo `argocd/apps/demo.yaml` e `argocd/manifests/demo/`, ArgoCD elimina da solo le risorse corrispondenti (pruning). Il CNAME `test.buddybudget.io` lo lascio (serve da riferimento per Fase 6 quando testeremo l'app reale su un sottodominio); si può sempre rimuovere dopo.

## Fine fase

Aggiorno CLAUDE.md, poi piano della **Fase 4** (dati: CloudNativePG + Redis + backup R2 + prova di restore).
