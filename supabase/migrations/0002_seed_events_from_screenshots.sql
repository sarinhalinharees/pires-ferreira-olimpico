-- Eventos transcritos das capturas de tela fornecidas pela escola.
-- Execute uma única vez no SQL Editor do Supabase.
-- Para o evento OLITEF de setembro/2027, o dia não foi informado:
-- ele fica marcado como precisão mensal e não aparece em um dia específico no calendário.

alter table public.events
  add column if not exists date_precision text not null default 'day'
    check (date_precision in ('day','month')),
  add column if not exists date_note text not null default '';

with seed(acronym,title,start_date,end_date,stage,description,date_precision,date_note) as (
 values
 ('OP','Inscrições 4ª OP 2026','2026-01-19','2026-05-08','Inscrição','Encerradas.','day',''),
 ('Mandacaru','Inscrições Mandacaru 2026','2026-02-01','2026-05-10','Inscrição','Encerradas.','day',''),
 ('OBMEP','Inscrições OBMEP 2026','2026-02-04','2026-03-16','Inscrição','Prazo encerrado.','day',''),
 ('OP','1ª fase 4ª OP 2026','2026-05-21','2026-05-23','1ª fase','Aplicada na escola.','day',''),
 ('Maratona Tech','Inscrições Maratona Tech 2026','2026-05-25','2026-07-31','Inscrição','Encerradas.','day',''),
 ('OBMEP','Prova da 1ª fase OBMEP 2026','2026-06-09',null,'1ª fase','Data oficial da edição 2026.','day',''),
 ('Maratona Tech','Fase 1 Maratona Tech 2026','2026-08-03','2026-10-04','1ª fase','','day',''),
 ('OBMEP','Divulgação dos classificados OBMEP 2026','2026-08-03',null,'Classificação','','day',''),
 ('ONC','Inscrições ONC 2026 até','2026-08-24',null,'Inscrição','Prazo encerrado.','day',''),
 ('OP','2ª fase 4ª OP 2026','2026-08-27',null,'2ª fase','','day',''),
 ('ONC','1ª fase ONC 2026','2026-08-27','2026-08-29','1ª fase','','day',''),
 ('OCHE','Prazo final de inscrições OCHE 2026','2026-09-04',null,'Inscrição','Encerrado.','day',''),
 ('ONC','Classificados ONC 2026','2026-09-10',null,'Classificação','','day',''),
 ('ONC','2ª fase ONC 2026','2026-09-17','2026-09-18','2ª fase','','day',''),
 ('ONC','Resultado ONC 2026','2026-10-08',null,'Resultado','','day',''),
 ('OBMEP','Prova da 2ª fase OBMEP 2026','2026-10-17',null,'2ª fase','','day',''),
 ('Maratona Tech','Fase 2 Maratona Tech 2026','2026-10-19','2026-11-08','2ª fase','','day',''),
 ('OP','Resultado final 4ª OP 2026','2026-10-21',null,'Resultado','Resultado divulgado.','day',''),
 ('Canguru','Início das inscrições Canguru 2027','2026-11-17',null,'Inscrição','Consultar regulamento para prazo final.','day',''),
 ('OLITEF','Inscrições OLITEF 2027','2026-11-19','2027-09-01','Inscrição','Cadastro e inscrição feitos pela escola.','day',''),
 ('OBLI','Inscrições OBLI 2027.1','2026-11-23','2027-05-12','Inscrição','Inscrição escolar gratuita para escola pública; consultar regras oficiais.','day',''),
 ('ONC','Solenidade nacional ONC 2026','2026-12-05',null,'Premiação','','day',''),
 ('OCHE','Final presencial OCHE 2026 — Campus Quixadá','2026-12-12',null,'Final','','day',''),
 ('OBMEP','Divulgação dos premiados OBMEP 2026','2026-12-15',null,'Resultado','Data prevista no regulamento.','day',''),
 ('Canguru','Prova oficial Canguru 2027','2027-03-18',null,'Prova','','day',''),
 ('Canguru','Janela alternativa de prova Canguru 2027','2027-03-19','2027-03-24','Prova','Datas alternativas previstas no cronograma.','day',''),
 ('OBLI','Prova online OBLI 2027.1','2027-05-19',null,'Prova','','day',''),
 ('OBLI','Resultados e certificados OBLI 2027.1','2027-05-26',null,'Resultado','','day',''),
 ('OBLI','Prazo para pedido de medalha OBLI 2027.1','2027-05-27','2027-07-07','Premiação','Medalha física opcional.','day',''),
 ('Canguru','Resultados Canguru 2027','2027-06-01',null,'Resultado','','day',''),
 ('Canguru','Relatórios de desempenho Canguru 2027','2027-08-10',null,'Resultado','','day',''),
 ('OLITEF','Prova OLITEF 2027 (dia a confirmar)','2027-09-01',null,'Prova','A organização informa apenas setembro de 2027; este registro representa o mês, não o dia exato.','month','Setembro de 2027 (dia a confirmar)'),
 ('OLITEF','Prazo para envio das respostas OLITEF 2027','2027-09-30',null,'Prova','','day',''),
 ('OLITEF','Resultado OLITEF 2027','2027-10-29',null,'Resultado','','day','')
)
insert into public.events (olympiad_id,title,start_date,end_date,stage,description,date_precision,date_note)
select o.id,s.title,s.start_date::date,s.end_date::date,s.stage,s.description,s.date_precision,s.date_note
from seed s join public.olympiads o on lower(o.acronym)=lower(s.acronym)
where not exists (
  select 1 from public.events e
  where e.olympiad_id=o.id and e.title=s.title and e.start_date=s.start_date::date
);

grant select, insert, update, delete on public.events to authenticated;
