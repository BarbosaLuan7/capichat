-- MIGRAÇÃO 1: Adicionar novas categorias ao enum
ALTER TYPE label_category ADD VALUE IF NOT EXISTS 'situacao';
ALTER TYPE label_category ADD VALUE IF NOT EXISTS 'perda';