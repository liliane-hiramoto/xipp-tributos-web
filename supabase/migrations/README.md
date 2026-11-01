# Migrações da instância Xipp

**Não há SQL para rodar aqui.** As tabelas `trib_*`, os buckets e as funções
`trib_is_user()` / `trib_is_admin()` moram no banco do Portal Xipp e nascem no
`supabase/SETUP-COMPLETO.sql` do repositório `portal-xipp` (migração 0007 do
`portal-fiscal-modelo`, testada no CI de lá).

As migrações 0001–0010 do canônico (`tributos-web`) NÃO servem neste banco: elas
liberam o acesso pelo módulo `fiscal`, e o portal usa o módulo `tributos`.
