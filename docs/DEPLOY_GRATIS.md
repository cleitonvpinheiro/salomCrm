# Publicar o Atelier com custo zero (ou mínimo)

Guia para colocar o Atelier no ar usando serviços gratuitos. Planos e limites mudam;
confirme-os nas páginas oficiais antes de se cadastrar.

| Peça | Opção | Observação |
|---|---|---|
| Servidor | Oracle Cloud Always Free (VM ARM Ampere A1) | Exige cartão para verificação; pode faltar capacidade na região. |
| Domínio | Subdomínio gratuito (ex.: DuckDNS) ou domínio próprio | HTTPS é emitido automaticamente pelo Caddy. |
| Banco | MongoDB Atlas Free | 512 MB, sem backup automático — use `deploy/backup.sh`. |
| E-mail | Provedor SMTP com plano gratuito | Necessário: a API não inicia em produção sem SMTP. |

> Este ambiente é adequado para começar com poucos salões. Não ofereça o serviço a
> clientes reais sem testar o backup **e a restauração**.

## 1. Banco de dados (Atlas)

1. Crie um banco **exclusivo de produção** (ex.: `atelier_prod`); não reutilize o de
   desenvolvimento ou testes.
2. Crie um usuário de banco novo com senha forte e permissão apenas nesse banco.
3. Em *Network Access*, libere somente o IP público da VM (não use `0.0.0.0/0`).
4. Copie a URI `mongodb+srv://...` para `MONGO_URL`.

## 2. Servidor (Oracle)

1. Crie uma instância *Always Free* (Ubuntu, forma `VM.Standard.A1.Flex`).
2. Na *Security List* da sub-rede, abra as portas TCP **80** e **443** (e 22 apenas
   para o seu IP). No Ubuntu da Oracle, libere também no `iptables`:
   ```bash
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. Instale Docker e Git: `curl -fsSL https://get.docker.com | sh`.

## 3. Domínio

Aponte o domínio (registro `A`) para o IP público da VM. Com DuckDNS, crie o
subdomínio e informe o IP. Aguarde a propagação antes de subir o Caddy.

## 4. Configuração e publicação

```bash
git clone https://github.com/cleitonvpinheiro/salomCrm.git && cd salomCrm
cp deploy/production.env.example deploy/production.env
chmod 600 deploy/production.env
nano deploy/production.env
docker compose --env-file deploy/production.env -f docker-compose.prod.yml up -d --build
```

Preencha `SITE_ADDRESS`, `PUBLIC_APP_URL`, `CORS_ORIGINS` (mesmo domínio, com `https://`),
`MONGO_URL`, `DB_NAME`, `DEFAULT_TENANT_SLUG`, `RATE_LIMIT_SECRET` (32+ caracteres),
`PLATFORM_OWNER_EMAIL`/`PLATFORM_OWNER_PASSWORD` (16+ caracteres) e o SMTP.

Verifique:

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS https://SEU_DOMINIO/api/
```

Se a API não ficar saudável, veja `docker compose -f docker-compose.prod.yml logs api`:
ela recusa iniciar com configuração insegura e informa o motivo.

## 5. Primeiro acesso

1. **Não execute `seed.py` em produção.**
2. Entre em `https://SEU_DOMINIO/platform/login` com a conta master.
3. Crie o espaço do salão e o primeiro administrador; troque a senha temporária.
4. Teste: login, cadastro de cliente, agendamento, agendamento online público e
   recuperação de senha (e-mail realmente entregue).

## 6. Backup

```bash
chmod +x deploy/backup.sh
sudo mkdir -p /var/backups/atelier && sudo chown "$USER" /var/backups/atelier
deploy/backup.sh
(crontab -l 2>/dev/null; echo "0 3 * * * $PWD/deploy/backup.sh >> $HOME/atelier-backup.log 2>&1") | crontab -
```

O backup fica na própria VM; para guardar uma cópia fora dela, configure um remoto
`rclone` (por exemplo, no Object Storage da Oracle) e defina `RCLONE_REMOTE`.
**Teste a restauração** em um banco separado antes de depender dela:

```bash
docker run --rm -i mongo:7 mongorestore --uri="URI_DO_BANCO_DE_TESTE" --archive --gzip \
  --nsFrom='atelier_prod.*' --nsTo='atelier_restore_test.*' < ARQUIVO.archive.gz
```

## 7. Atualizações

```bash
git pull && docker compose --env-file deploy/production.env -f docker-compose.prod.yml up -d --build
```

Mantenha o sistema do servidor atualizado (`sudo apt update && sudo apt upgrade`) e
acompanhe o uso do Atlas (512 MB).
